import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopsService } from '../shops/shops.service';

const SHOPIFY_API_VERSION = '2024-01';
const PLAN_PRICE = '19.00';
const PLAN_NAME = 'Conversion Optimizer — $19/month';

export interface CreateChargeResult {
  confirmationUrl: string;
  chargeId: number;
}

export interface ChargeStatus {
  id: number;
  status: string;
  name: string;
  price: string;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly config: ConfigService,
    private readonly shops: ShopsService,
  ) {}

  /**
   * Create a recurring application charge for the shop and return the URL
   * where the merchant must approve the charge.
   */
  async createRecurringCharge(shopDomain: string): Promise<CreateChargeResult> {
    const normalized = this.normalizeDomain(shopDomain);
    const shop = await this.shops.getByDomain(normalized);
    const accessToken = this.shops.getAccessToken(shop);

    const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    if (!baseUrl) {
      throw new BadRequestException('SHOPIFY_APP_URL is not configured');
    }
    const returnUrl = `${baseUrl}/api/billing/return?shop=${encodeURIComponent(normalized)}`;

    const body = {
      recurring_application_charge: {
        name: PLAN_NAME,
        price: PLAN_PRICE,
        return_url: returnUrl,
        test: this.config.get<string>('BILLING_TEST') === 'true',
      },
    };

    const url = `https://${normalized}/admin/api/${SHOPIFY_API_VERSION}/recurring_application_charges.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Shopify billing API error: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      recurring_application_charge?: {
        id: number;
        confirmation_url?: string;
        status?: string;
      };
    };
    const charge = data.recurring_application_charge;
    if (!charge?.confirmation_url) {
      throw new BadRequestException('Shopify did not return a confirmation URL');
    }

    return {
      confirmationUrl: charge.confirmation_url,
      chargeId: charge.id,
    };
  }

  /**
   * After the merchant approves, Shopify redirects to our return_url with charge_id.
   * Fetch the charge; if active (or accepted on older API), mark the shop as paid.
   * Optionally call activate for older API versions.
   */
  async confirmAndActivate(shopDomain: string, chargeId: string): Promise<void> {
    const normalized = this.normalizeDomain(shopDomain);
    const shop = await this.shops.getByDomain(normalized);
    const accessToken = this.shops.getAccessToken(shop);

    const status = await this.getChargeStatus(normalized, accessToken, chargeId);
    if (status.status === 'active') {
      await this.shops.setPaidPlan(normalized, String(status.id));
      return;
    }
    if (status.status === 'pending') {
      // As of 2021-01 charges auto-activate; call activate for older behavior.
      await this.activateCharge(normalized, accessToken, chargeId);
      const after = await this.getChargeStatus(normalized, accessToken, chargeId);
      if (after.status === 'active') {
        await this.shops.setPaidPlan(normalized, String(after.id));
        return;
      }
    }
    throw new BadRequestException(`Charge not active: ${status.status}`);
  }

  private async getChargeStatus(
    shopDomain: string,
    accessToken: string,
    chargeId: string,
  ): Promise<ChargeStatus> {
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/recurring_application_charges/${chargeId}.json`;
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Failed to get charge: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      recurring_application_charge?: { id: number; status: string; name: string; price: string };
    };
    const charge = data.recurring_application_charge;
    if (!charge) throw new BadRequestException('Charge not found');
    return {
      id: charge.id,
      status: charge.status,
      name: charge.name,
      price: charge.price,
    };
  }

  private async activateCharge(
    shopDomain: string,
    accessToken: string,
    chargeId: string,
  ): Promise<void> {
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/recurring_application_charges/${chargeId}/activate.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ recurring_application_charge: { id: Number(chargeId) } }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Failed to activate charge: ${res.status} ${text}`);
    }
  }

  private normalizeDomain(domain: string): string {
    const d = domain.toLowerCase().trim();
    return d.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
  }
}
