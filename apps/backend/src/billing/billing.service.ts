import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopsService } from '../shops/shops.service';
import type { Shop } from '../shops/entities/shop.entity';

const SHOPIFY_API_VERSION = '2024-01';

export const PLANS = {
  starter: { price: 9, interval: 'EVERY_30_DAYS', name: 'Conversion Optimizer — Starter $9/month', key: 'starter' },
  growth: { price: 19, interval: 'EVERY_30_DAYS', name: 'Conversion Optimizer — Growth $19/month', key: 'growth' },
  pro: { price: 29, interval: 'EVERY_30_DAYS', name: 'Conversion Optimizer — Pro $29/month', key: 'pro' },
  pro_annual: { price: 290, interval: 'ANNUAL', name: 'Conversion Optimizer — Pro $290/year', key: 'pro_annual' },
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

interface ActiveSubscriptionSnapshot {
  id: string;
  name?: string | null;
  status?: string | null;
  createdAt?: string | null;
  currentPeriodEnd?: string | null;
  interval?: string | null;
  amount?: number | null;
}

export interface ActiveSubscriptionInfo {
  id: string;
  planKey: PlanKey;
  planLabel: string;
  status: string;
  currentPeriodEnd: string | null;
}

export interface CancelSubscriptionResult {
  currentPeriodEnd: string | null;
  planLabel: string;
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

  private throwReconnectRequired(context: string): never {
    console.error(`[Billing] ${context}: shop token invalid; reconnect required`);
    throw new BadRequestException('SHOP_RECONNECT_REQUIRED');
  }

  /**
   * Create a recurring app subscription via GraphQL and return the confirmation URL
   * where the merchant must approve the charge.
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
    // Use test charges when BILLING_TEST is set (e.g. when testing on a development store).
    // Development stores cannot accept real charges; they only accept test subscriptions.
    const billingTestRaw = this.config.get<string>('BILLING_TEST') ?? process.env.BILLING_TEST ?? '';
    const billingTest = /^(true|1)$/i.test(String(billingTestRaw).trim());
    const isTest = billingTest;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Billing] BILLING_TEST:', billingTestRaw, '→ test:', isTest);
    }
    if (isTest && process.env.NODE_ENV === 'production') {
      console.warn('[Billing] Creating TEST subscription. Set BILLING_TEST=false for real charges.');
    }

    const mutation = `mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean, $replacementBehavior: AppSubscriptionReplacementBehavior) {
  appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test, replacementBehavior: $replacementBehavior) {
    userErrors { field message }
    confirmationUrl
    appSubscription { id }
  }
}`;
    const variables = {
      name: planConfig.name,
      returnUrl,
      test: isTest,
      replacementBehavior: 'APPLY_IMMEDIATELY',
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: planConfig.price, currencyCode: 'USD' },
              interval: planConfig.interval,
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

    if (res.status === 401) {
      this.throwReconnectRequired('createRecurringCharge');
    }
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
    const gid = `gid://shopify/AppSubscription/${subscriptionId}`;

    // Query the specific subscription by GID — more reliable than searching activeSubscriptions
    // which can miss a newly confirmed charge due to Shopify's eventual consistency.
    const nodeQuery = `query GetSubscription($id: ID!) {
  node(id: $id) {
    ... on AppSubscription {
      id
      name
      status
      currentPeriodEnd
      lineItems {
        plan {
          pricingDetails {
            __typename
            ... on AppRecurringPricing {
              interval
              price { amount currencyCode }
            }
          }
        }
      }
    }
  }
}`;
    const url = `https://${normalized}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const nodeRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query: nodeQuery, variables: { id: gid } }),
    });
    if (nodeRes.status === 401) this.throwReconnectRequired('confirmAndActivate');
    if (!nodeRes.ok) {
      const text = await nodeRes.text();
      console.error('[Billing] confirmAndActivate node query failed', nodeRes.status, text);
      throw new BadRequestException('Unable to verify subscription. Please try again.');
    }
    const nodeData = (await nodeRes.json()) as {
      data?: { node?: { id?: string; name?: string; status?: string; currentPeriodEnd?: string; lineItems?: { plan?: { pricingDetails?: { __typename?: string; interval?: string; price?: { amount?: string } } } }[] } };
      errors?: { message?: string }[];
    };
    if (nodeData.errors?.length) {
      console.error('[Billing] confirmAndActivate GraphQL errors', nodeData.errors);
      throw new BadRequestException('Unable to verify subscription. Please try again.');
    }
    const sub = nodeData.data?.node;
    const status = String(sub?.status ?? '').toUpperCase();
    if (!sub || !['ACTIVE', 'PENDING'].includes(status)) {
      // Fall back to scanning activeSubscriptions (covers edge cases)
      const active = await this.getActiveSubscriptionSnapshots(normalized, accessToken);
      const fallback = active.find((s) => this.parseSubscriptionId(s.id) === subscriptionId);
      if (fallback) {
        await this.shops.setPaidPlan(normalized, String(subscriptionId), planKey, {
          currentPeriodEndIso: fallback.currentPeriodEnd ?? undefined,
        });
        return;
      }
      console.error('[Billing] Subscription not found or not active', chargeId, 'status:', status);
      throw new BadRequestException('Subscription could not be activated. Please try again or contact support.');
    }
    // Resolve plan from snapshot for more reliable plan key (price/interval beats URL param)
    const snapshot: ActiveSubscriptionSnapshot = {
      id: sub.id ?? gid,
      name: sub.name ?? null,
      status: sub.status ?? null,
      createdAt: null,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
      interval: (sub.lineItems?.[0]?.plan?.pricingDetails as { interval?: string })?.interval ?? null,
      amount: sub.lineItems?.[0]?.plan?.pricingDetails?.price?.amount != null
        ? Number(sub.lineItems[0].plan!.pricingDetails!.price!.amount)
        : null,
    };
    const resolved = this.resolvePlanFromSnapshot(snapshot);
    const finalPlanKey = resolved.planKey !== 'growth' ? resolved.planKey : planKey;
    await this.shops.setPaidPlan(normalized, String(subscriptionId), finalPlanKey, {
      currentPeriodEndIso: sub.currentPeriodEnd ?? undefined,
    });
  }

  private parseSubscriptionId(idOrGid: string): number {
    const s = String(idOrGid).trim();
    const match = s.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : parseInt(s, 10) || 0;
  }

  /** When Shopify has no active charge but DB still shows paid access in grace — idempotent cancel success. */
  private tryReturnGraceOnlyCancel(shop: Shop): CancelSubscriptionResult | null {
    const graceUntil = this.shops.getBillingGraceUntil(shop);
    if (graceUntil?.trim()) {
      const end = new Date(graceUntil);
      if (!Number.isNaN(end.getTime()) && end.getTime() > Date.now()) {
        const planLabel = this.shops.getCancelledPlanLabel(shop) ?? this.shops.getPlanLabel(shop);
        return { currentPeriodEnd: graceUntil.trim(), planLabel };
      }
    }
    if (shop.plan === 'free' && this.shops.getCancelledPlanLabel(shop)?.trim()) {
      const planLabel = this.shops.getCancelledPlanLabel(shop)!.trim();
      const periodEnd = this.shops.getBillingPeriodEnd(shop);
      return { currentPeriodEnd: periodEnd, planLabel };
    }
    return null;
  }

  private async fetchAppSubscriptionStatusByGid(
    shopDomain: string,
    accessToken: string,
    gid: string,
  ): Promise<string | null> {
    const query = `query SubStatus($id: ID!) { node(id: $id) { ... on AppSubscription { status } } }`;
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query, variables: { id: gid } }),
    });
    if (res.status === 401) this.throwReconnectRequired('fetchAppSubscriptionStatusByGid');
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { node?: { status?: string } | null }; errors?: unknown[] };
    if (data.errors?.length) return null;
    const st = data.data?.node?.status;
    return st ? String(st).toUpperCase() : null;
  }

  /**
   * Cancel the shop's active app subscription via GraphQL. Stops future billing; merchant keeps access until period end.
   * Clears our billing state after successful cancel.
   */
  async cancelSubscription(shopDomain: string): Promise<CancelSubscriptionResult> {
    const normalized = this.normalizeDomain(shopDomain);
    const shop = await this.shops.getByDomain(normalized);
    const accessToken = this.shops.getAccessToken(shop);
    let active: ActiveSubscriptionSnapshot[];
    try {
      active = await this.getActiveSubscriptionSnapshots(normalized, accessToken);
    } catch (e) {
      const grace = this.tryReturnGraceOnlyCancel(shop);
      if (grace) {
        console.warn('[Billing] cancelSubscription: could not list subscriptions; DB has grace — no-op', e);
        return grace;
      }
      throw e;
    }

    if (!active.length) {
      const grace = this.tryReturnGraceOnlyCancel(shop);
      if (grace) return grace;
      await this.shops.clearBilling(normalized, null, null);
      return { currentPeriodEnd: null, planLabel: '' };
    }

    const preferredId = shop.recurringChargeId?.trim()
      ? `gid://shopify/AppSubscription/${shop.recurringChargeId.replace(/\D/g, '') || shop.recurringChargeId}`
      : '';
    const target = active.find((s) => s.id === preferredId)
      ?? (shop.recurringChargeId?.trim()
        ? active.find((s) => this.parseSubscriptionId(s.id) === this.parseSubscriptionId(shop.recurringChargeId as string))
        : undefined)
      ?? active[0];
    const gid = target.id;

    const mutation = `mutation AppSubscriptionCancel($id: ID!) {
  appSubscriptionCancel(id: $id) {
    userErrors { field message }
    appSubscription { id status }
  }
}`;
    const url = `https://${normalized}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: mutation, variables: { id: gid } }),
    });

    if (res.status === 401) {
      this.throwReconnectRequired('cancelSubscription');
    }
    if (!res.ok) {
      const grace = this.tryReturnGraceOnlyCancel(shop);
      if (grace) {
        console.warn('[Billing] cancelSubscription HTTP', res.status, 'failed; DB has grace — no-op');
        return grace;
      }
      const text = await res.text();
      console.error('[Billing] cancelSubscription failed', res.status, text);
      throw new BadRequestException('Unable to cancel subscription. Please try again or cancel from Shopify Settings → Billing.');
    }

    const data = (await res.json()) as {
      data?: { appSubscriptionCancel?: { userErrors?: { message?: string }[] }; };
      errors?: { message?: string }[];
    };
    const errors = data.errors ?? data.data?.appSubscriptionCancel?.userErrors ?? [];
    if (errors.length) {
      const msg = errors.map((e: { message?: string }) => e?.message ?? '').filter(Boolean).join('; ') || 'Subscription could not be cancelled.';
      const alreadyDone = /already|cancel(?:l)?ed|inactive|not active|expired|frozen|declined|ended|no longer|unable to cancel|duplicate|invalid subscription|not found|does not exist|access denied|must be active|not eligible/i.test(
        msg,
      );
      let treatAsDone = alreadyDone;
      if (!treatAsDone) {
        const nodeStatus = await this.fetchAppSubscriptionStatusByGid(normalized, accessToken, gid);
        if (nodeStatus && !['ACTIVE', 'PENDING'].includes(nodeStatus)) {
          treatAsDone = true;
          console.warn('[Billing] cancelSubscription: userErrors but node status is', nodeStatus, '- clearing DB');
        }
      }
      if (!treatAsDone) {
        console.error('[Billing] cancelSubscription errors', msg);
        throw new BadRequestException(msg);
      }
      if (alreadyDone) console.warn('[Billing] cancelSubscription already handled on Shopify side, clearing DB state');
    }

    const resolved = this.resolvePlanFromSnapshot(target);
    await this.shops.clearBilling(normalized, target.currentPeriodEnd ?? null, resolved.planLabel);
    return {
      currentPeriodEnd: target.currentPeriodEnd ?? null,
      planLabel: resolved.planLabel,
    };
  }

  /**
   * Returns active subscription info for home/banner sync (useful after reinstall with persisting plan).
   */
  async getActiveSubscriptionInfo(shopDomain: string): Promise<ActiveSubscriptionInfo | null> {
    const normalized = this.normalizeDomain(shopDomain);
    const shop = await this.shops.getByDomain(normalized);
    const accessToken = this.shops.getAccessToken(shop);
    const active = await this.getActiveSubscriptionSnapshots(normalized, accessToken);
    if (!active.length) return null;
    const target = this.pickPreferredActiveSubscription(active, shop.recurringChargeId ?? undefined);
    const resolved = this.resolvePlanFromSnapshot(target);
    return {
      id: target.id,
      planKey: resolved.planKey,
      planLabel: resolved.planLabel,
      status: String(target.status ?? ''),
      currentPeriodEnd: target.currentPeriodEnd ?? null,
    };
  }

  private async getActiveSubscriptionSnapshots(shopDomain: string, accessToken: string): Promise<ActiveSubscriptionSnapshot[]> {
    const query = `query {
  currentAppInstallation {
    activeSubscriptions {
      id
      name
      status
      createdAt
      currentPeriodEnd
      lineItems {
        plan {
          pricingDetails {
            __typename
            ... on AppRecurringPricing {
              interval
              price { amount currencyCode }
            }
          }
        }
      }
    }
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
    if (res.status === 401) {
      this.throwReconnectRequired('getActiveSubscriptions');
    }
    if (!res.ok) {
      const text = await res.text();
      console.error('[Billing] getActiveSubscriptions failed', res.status, text);
      throw new BadRequestException('Unable to verify subscription.');
    }
    const data = (await res.json()) as {
      data?: {
        currentAppInstallation?: {
          activeSubscriptions?: {
            id?: string;
            name?: string;
            status?: string;
            createdAt?: string;
            currentPeriodEnd?: string;
            lineItems?: {
              plan?: {
                pricingDetails?: {
                  __typename?: string;
                  interval?: string;
                  price?: { amount?: string };
                };
              };
            }[];
          }[];
        };
      };
      errors?: { message?: string }[];
    };
    // Log GraphQL errors but only hard-fail if we have no usable subscription data.
    if (data.errors?.length) {
      const hasData = (data.data?.currentAppInstallation?.activeSubscriptions?.length ?? 0) > 0;
      console.error('[Billing] GraphQL errors (hasData=' + String(hasData) + ')', data.errors);
      if (!hasData) {
        throw new BadRequestException('Unable to verify subscription.');
      }
    }
    const installation = data.data?.currentAppInstallation;
    const subs = installation?.activeSubscriptions ?? [];
    return subs
      .map((s) => ({
        id: s.id ?? '',
        name: s.name ?? null,
        status: s.status ?? null,
        createdAt: s.createdAt ?? null,
        currentPeriodEnd: s.currentPeriodEnd ?? null,
        interval: s.lineItems?.[0]?.plan?.pricingDetails?.interval ?? null,
        amount: s.lineItems?.[0]?.plan?.pricingDetails?.price?.amount != null
          ? Number(s.lineItems?.[0]?.plan?.pricingDetails?.price?.amount)
          : null,
      }))
      .filter((s) => Boolean(s.id));
  }

  private pickPreferredActiveSubscription(active: ActiveSubscriptionSnapshot[], preferredRecurringChargeId?: string): ActiveSubscriptionSnapshot {
    const preferredId = preferredRecurringChargeId?.trim()
      ? `gid://shopify/AppSubscription/${preferredRecurringChargeId.replace(/\D/g, '') || preferredRecurringChargeId}`
      : '';
    if (preferredId) {
      const exact = active.find((s) => s.id === preferredId);
      if (exact) return exact;
      const numeric = this.parseSubscriptionId(preferredRecurringChargeId as string);
      const byNumeric = active.find((s) => this.parseSubscriptionId(s.id) === numeric);
      if (byNumeric) return byNumeric;
    }
    const sorted = [...active].sort((a, b) => {
      const amountA = Number.isFinite(a.amount ?? NaN) ? Number(a.amount) : -1;
      const amountB = Number.isFinite(b.amount ?? NaN) ? Number(b.amount) : -1;
      if (amountA !== amountB) return amountB - amountA;
      const annualA = String(a.interval ?? '').toUpperCase() === 'ANNUAL' ? 1 : 0;
      const annualB = String(b.interval ?? '').toUpperCase() === 'ANNUAL' ? 1 : 0;
      if (annualA !== annualB) return annualB - annualA;
      const createdA = Date.parse(String(a.createdAt ?? ''));
      const createdB = Date.parse(String(b.createdAt ?? ''));
      return (Number.isNaN(createdB) ? 0 : createdB) - (Number.isNaN(createdA) ? 0 : createdA);
    });
    return sorted[0];
  }

  private resolvePlanFromSnapshot(sub: ActiveSubscriptionSnapshot): { planKey: PlanKey; planLabel: string } {
    const name = String(sub.name ?? '').toLowerCase();
    if (name.includes('pro') && (name.includes('year') || name.includes('annual'))) {
      return { planKey: 'pro_annual', planLabel: 'Pro Annual' };
    }
    if (name.includes('pro')) return { planKey: 'pro', planLabel: 'Pro' };
    if (name.includes('starter')) return { planKey: 'starter', planLabel: 'Starter' };
    if (name.includes('growth')) return { planKey: 'growth', planLabel: 'Growth' };
    if (String(sub.interval).toUpperCase() === 'ANNUAL') return { planKey: 'pro_annual', planLabel: 'Pro Annual' };
    if (sub.amount === 290) return { planKey: 'pro_annual', planLabel: 'Pro Annual' };
    if (sub.amount === 29) return { planKey: 'pro', planLabel: 'Pro' };
    if (sub.amount === 19) return { planKey: 'growth', planLabel: 'Growth' };
    if (sub.amount === 9) return { planKey: 'starter', planLabel: 'Starter' };
    return { planKey: 'growth', planLabel: 'Growth' };
  }

  private normalizeDomain(domain: string): string {
    const d = domain.toLowerCase().trim();
    return d.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
  }
}
