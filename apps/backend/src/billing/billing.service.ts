import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopsService } from '../shops/shops.service';

const SHOPIFY_API_VERSION = '2024-01';

export const PLANS = {
  starter: { price: 9, name: 'Conversion Optimizer — Starter $9/month', key: 'starter' },
  growth: { price: 19, name: 'Conversion Optimizer — Growth $19/month', key: 'growth' },
  pro: { price: 29, name: 'Conversion Optimizer — Pro $29/month', key: 'pro' },
} as const;

export type PlanKey = keyof typeof PLANS;

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

/**
 * Billing uses the GraphQL Admin API (appSubscriptionCreate) instead of the legacy REST
 * recurring_application_charges endpoint. REST returns 422 "application is currently owned
 * by a Shop" for apps in the Dev Dashboard; GraphQL billing works for all app types.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly config: ConfigService,
    private readonly shops: ShopsService,
  ) {}

  /**
   * Create a recurring app subscription via GraphQL and return the confirmation URL
   * where the merchant must approve the charge. planKey must be one of: starter, growth, pro.
   */
  async createRecurringCharge(shopDomain: string, planKey: PlanKey = 'growth'): Promise<CreateChargeResult> {
    const normalized = this.normalizeDomain(shopDomain);
    const shop = await this.shops.getByDomain(normalized);
    const accessToken = this.shops.getAccessToken(shop);

    const planConfig = PLANS[planKey];
    if (!planConfig) {
      throw new BadRequestException(`Invalid plan: ${planKey}`);
    }

    const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    if (!baseUrl) {
      throw new BadRequestException('SHOPIFY_APP_URL is not configured');
    }
    const returnUrl = `${baseUrl}/api/billing/return?shop=${encodeURIComponent(normalized)}&plan=${encodeURIComponent(planKey)}`;
    const isTest = this.config.get<string>('BILLING_TEST') === 'true';

    const mutation = `mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
  appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
    userErrors { field message }
    confirmationUrl
    appSubscription { id }
  }
}`;
    const variables = {
      name: planConfig.name,
      returnUrl,
      test: isTest,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: planConfig.price, currencyCode: 'USD' },
              interval: 'EVERY_30_DAYS',
            },
          },
        },
      ],
    };

    const url = `https://${normalized}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Billing] create subscription failed', res.status, text);
      throw new BadRequestException('Unable to create subscription. Please try again.');
    }

    const data = (await res.json()) as {
      data?: {
        appSubscriptionCreate?: {
          userErrors?: { field?: string; message?: string }[];
          confirmationUrl?: string | null;
          appSubscription?: { id?: string } | null;
        };
      };
      errors?: { message?: string }[];
    };

    const gqlErrors = data.errors?.length ? data.errors : data.data?.appSubscriptionCreate?.userErrors;
    if (gqlErrors?.length) {
      const msg = gqlErrors.map((e) => (e as { message?: string }).message ?? JSON.stringify(e)).join('; ');
      console.error('[Billing] GraphQL errors', msg);
      throw new BadRequestException('Unable to create subscription. Please try again.');
    }

    const create = data.data?.appSubscriptionCreate;
    const confirmationUrl = create?.confirmationUrl ?? null;
    const appSubscriptionId = create?.appSubscription?.id ?? null;

    if (!confirmationUrl) {
      console.error('[Billing] No confirmation URL in response');
      throw new BadRequestException('Unable to create subscription. Please try again.');
    }

    const chargeId = appSubscriptionId ? this.parseSubscriptionId(appSubscriptionId) : 0;
    return {
      confirmationUrl,
      chargeId,
    };
  }

  /**
   * After the merchant approves, Shopify redirects to our return_url with charge_id and plan.
   * Confirm the subscription is active via GraphQL and mark the shop as paid with the plan tier.
   */
  async confirmAndActivate(shopDomain: string, chargeId: string, planKey: PlanKey = 'growth'): Promise<void> {
    const normalized = this.normalizeDomain(shopDomain);
    const shop = await this.shops.getByDomain(normalized);
    const accessToken = this.shops.getAccessToken(shop);

    const subscriptionId = this.parseSubscriptionId(chargeId);
    const activeSubscriptions = await this.getActiveSubscriptions(normalized, accessToken);
    const matched = activeSubscriptions.some((id) => this.parseSubscriptionId(id) === subscriptionId || id === chargeId);
    if (matched) {
      await this.shops.setPaidPlan(normalized, String(subscriptionId), planKey);
      return;
    }
    console.error('[Billing] Subscription not found or not active', chargeId);
    throw new BadRequestException('Subscription could not be activated. Please try again or contact support.');
  }

  private parseSubscriptionId(idOrGid: string): number {
    const s = String(idOrGid).trim();
    const match = s.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : parseInt(s, 10) || 0;
  }

  private async getActiveSubscriptions(shopDomain: string, accessToken: string): Promise<string[]> {
    const query = `query {
  currentAppInstallation {
    activeSubscriptions { id }
  }
}`;
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[Billing] getActiveSubscriptions failed', res.status, text);
      throw new BadRequestException('Unable to verify subscription.');
    }
    const data = (await res.json()) as {
      data?: { currentAppInstallation?: { activeSubscriptions?: { id?: string }[] } };
      errors?: { message?: string }[];
    };
    if (data.errors?.length) {
      console.error('[Billing] GraphQL errors', data.errors);
      throw new BadRequestException('Unable to verify subscription.');
    }
    const subs = data.data?.currentAppInstallation?.activeSubscriptions ?? [];
    return subs.map((s) => s.id ?? '').filter(Boolean);
  }

  private normalizeDomain(domain: string): string {
    const d = domain.toLowerCase().trim();
    return d.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
  }
}
