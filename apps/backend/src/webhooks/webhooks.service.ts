import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ShopsService } from '../shops/shops.service';

const PROCESSED_TTL_SEC = 86400; // 24h
const processed = new Map<string, number>();

function pruneProcessed(): void {
  const now = Date.now();
  for (const [k, exp] of processed.entries()) {
    if (exp < now) processed.delete(k);
  }
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly config: ConfigService,
    private readonly shops: ShopsService,
  ) {}

  verifyHmac(rawBody: string, hmacHeader: string | undefined): boolean {
    if (!hmacHeader) return false;
    const secret = this.config.get<string>('SHOPIFY_API_SECRET');
    const computed = createHmac('sha256', secret!).update(rawBody, 'utf8').digest('base64');
    return computed === hmacHeader;
  }

  async isProcessed(idempotencyKey: string): Promise<boolean> {
    if (processed.size > 10000) pruneProcessed();
    const exp = processed.get(idempotencyKey);
    return exp != null && exp > Date.now();
  }

  async markProcessed(idempotencyKey: string): Promise<void> {
    processed.set(idempotencyKey, Date.now() + PROCESSED_TTL_SEC * 1000);
  }

  async handle(topic: string, payload: Record<string, unknown>, shopDomainHeader?: string): Promise<void> {
    const shopDomain = shopDomainHeader?.toLowerCase().trim() || this.getShopDomain(payload);
    if (!shopDomain) return;

    switch (topic) {
      case 'app_uninstalled':
        await this.shops.markUninstalled(shopDomain);
        break;
      case 'products_create':
      case 'products_update':
        // In a full impl we'd enqueue a sync job or upsert products_cache here
        break;
      case 'products_delete':
        break;
      case 'orders_create':
      case 'orders_updated':
        break;
      case 'themes_publish':
        break;
      case 'shop_update':
        break;
      case 'app_subscriptions_update':
      case 'app_subscriptions_delete':
        await this.handleSubscriptionUpdate(payload, shopDomain);
        break;
      default:
        // unknown topic, no-op
        break;
    }
  }

  /**
   * When a subscription is cancelled or updated, clear our billing if the charge is no longer active.
   * Payload may contain app_subscription with id (GID or numeric) and status.
   */
  private async handleSubscriptionUpdate(
    payload: Record<string, unknown>,
    shopDomain: string,
  ): Promise<void> {
    const sub = payload.app_subscription as Record<string, unknown> | undefined;
    if (!sub) return;
    const status = sub.status as string | undefined;
    if (status !== 'cancelled' && status !== 'expired' && status !== 'frozen') return;
    // id might be GID (gid://shopify/AppSubscription/123) or numeric
    const rawId = sub.id ?? (payload as { recurring_application_charge_id?: number }).recurring_application_charge_id;
    const chargeId = typeof rawId === 'number' ? String(rawId) : typeof rawId === 'string' ? rawId.replace(/^.*\/(\d+)$/, '$1') : null;
    if (chargeId) {
      const shop = await this.shops.findByRecurringChargeId(chargeId);
      if (shop) await this.shops.clearBilling(shop.domain);
    } else {
      // Fallback: clear by shop domain if we know this webhook means "no active sub"
      await this.shops.clearBilling(shopDomain);
    }
  }

  private getShopDomain(payload: Record<string, unknown>): string | null {
    const shop = payload.shop as string | undefined;
    if (typeof shop === 'string') return shop;
    const d = (payload as { shop_domain?: string }).shop_domain;
    if (typeof d === 'string') return d;
    return null;
  }
}
