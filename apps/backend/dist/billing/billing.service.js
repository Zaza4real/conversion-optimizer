"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = exports.PLANS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shops_service_1 = require("../shops/shops.service");
const SHOPIFY_API_VERSION = '2024-01';
exports.PLANS = {
    starter: { price: 9, interval: 'EVERY_30_DAYS', name: 'Conversion Optimizer — Starter $9/month', key: 'starter' },
    growth: { price: 19, interval: 'EVERY_30_DAYS', name: 'Conversion Optimizer — Growth $19/month', key: 'growth' },
    pro: { price: 29, interval: 'EVERY_30_DAYS', name: 'Conversion Optimizer — Pro $29/month', key: 'pro' },
    pro_annual: { price: 290, interval: 'ANNUAL', name: 'Conversion Optimizer — Pro $290/year', key: 'pro_annual' },
};
let BillingService = class BillingService {
    constructor(config, shops) {
        this.config = config;
        this.shops = shops;
    }
    throwReconnectRequired(context) {
        console.error(`[Billing] ${context}: shop token invalid; reconnect required`);
        throw new common_1.BadRequestException('SHOP_RECONNECT_REQUIRED');
    }
    async createRecurringCharge(shopDomain, planKey = 'growth') {
        const normalized = this.normalizeDomain(shopDomain);
        const shop = await this.shops.getByDomain(normalized);
        const accessToken = this.shops.getAccessToken(shop);
        const planConfig = exports.PLANS[planKey];
        if (!planConfig) {
            throw new common_1.BadRequestException(`Invalid plan: ${planKey}`);
        }
        const baseUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        if (!baseUrl) {
            throw new common_1.BadRequestException('SHOPIFY_APP_URL is not configured');
        }
        const returnUrl = `${baseUrl}/api/billing/return?shop=${encodeURIComponent(normalized)}&plan=${encodeURIComponent(planKey)}`;
        const billingTestRaw = this.config.get('BILLING_TEST') ?? process.env.BILLING_TEST ?? '';
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
            throw new common_1.BadRequestException('Unable to create subscription. Please try again.');
        }
        const data = (await res.json());
        const gqlErrors = data.errors?.length ? data.errors : data.data?.appSubscriptionCreate?.userErrors;
        if (gqlErrors?.length) {
            const msg = gqlErrors.map((e) => e.message ?? JSON.stringify(e)).join('; ');
            console.error('[Billing] GraphQL errors', msg);
            throw new common_1.BadRequestException('Unable to create subscription. Please try again.');
        }
        const create = data.data?.appSubscriptionCreate;
        const confirmationUrl = create?.confirmationUrl ?? null;
        const appSubscriptionId = create?.appSubscription?.id ?? null;
        if (!confirmationUrl) {
            console.error('[Billing] No confirmation URL in response');
            throw new common_1.BadRequestException('Unable to create subscription. Please try again.');
        }
        const chargeId = appSubscriptionId ? this.parseSubscriptionId(appSubscriptionId) : 0;
        return {
            confirmationUrl,
            chargeId,
        };
    }
    async confirmAndActivate(shopDomain, chargeId, planKey = 'growth') {
        const normalized = this.normalizeDomain(shopDomain);
        const shop = await this.shops.getByDomain(normalized);
        const accessToken = this.shops.getAccessToken(shop);
        const subscriptionId = this.parseSubscriptionId(chargeId);
        const gid = `gid://shopify/AppSubscription/${subscriptionId}`;
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
        if (nodeRes.status === 401)
            this.throwReconnectRequired('confirmAndActivate');
        if (!nodeRes.ok) {
            const text = await nodeRes.text();
            console.error('[Billing] confirmAndActivate node query failed', nodeRes.status, text);
            throw new common_1.BadRequestException('Unable to verify subscription. Please try again.');
        }
        const nodeData = (await nodeRes.json());
        if (nodeData.errors?.length) {
            console.error('[Billing] confirmAndActivate GraphQL errors', nodeData.errors);
            throw new common_1.BadRequestException('Unable to verify subscription. Please try again.');
        }
        const sub = nodeData.data?.node;
        const status = String(sub?.status ?? '').toUpperCase();
        if (!sub || !['ACTIVE', 'PENDING'].includes(status)) {
            const active = await this.getActiveSubscriptionSnapshots(normalized, accessToken);
            const fallback = active.find((s) => this.parseSubscriptionId(s.id) === subscriptionId);
            if (fallback) {
                await this.shops.setPaidPlan(normalized, String(subscriptionId), planKey, {
                    currentPeriodEndIso: fallback.currentPeriodEnd ?? undefined,
                });
                return;
            }
            console.error('[Billing] Subscription not found or not active', chargeId, 'status:', status);
            throw new common_1.BadRequestException('Subscription could not be activated. Please try again or contact support.');
        }
        const snapshot = {
            id: sub.id ?? gid,
            name: sub.name ?? null,
            status: sub.status ?? null,
            createdAt: null,
            currentPeriodEnd: sub.currentPeriodEnd ?? null,
            interval: sub.lineItems?.[0]?.plan?.pricingDetails?.interval ?? null,
            amount: sub.lineItems?.[0]?.plan?.pricingDetails?.price?.amount != null
                ? Number(sub.lineItems[0].plan.pricingDetails.price.amount)
                : null,
        };
        const resolved = this.resolvePlanFromSnapshot(snapshot);
        const finalPlanKey = resolved.planKey !== 'growth' ? resolved.planKey : planKey;
        await this.shops.setPaidPlan(normalized, String(subscriptionId), finalPlanKey, {
            currentPeriodEndIso: sub.currentPeriodEnd ?? undefined,
        });
    }
    parseSubscriptionId(idOrGid) {
        const s = String(idOrGid).trim();
        const match = s.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : parseInt(s, 10) || 0;
    }
    tryReturnGraceOnlyCancel(shop) {
        const graceUntil = this.shops.getBillingGraceUntil(shop);
        if (graceUntil?.trim()) {
            const end = new Date(graceUntil);
            if (!Number.isNaN(end.getTime()) && end.getTime() > Date.now()) {
                const planLabel = this.shops.getCancelledPlanLabel(shop) ?? this.shops.getPlanLabel(shop);
                return { currentPeriodEnd: graceUntil.trim(), planLabel };
            }
        }
        if (shop.plan === 'free' && this.shops.getCancelledPlanLabel(shop)?.trim()) {
            const planLabel = this.shops.getCancelledPlanLabel(shop).trim();
            const periodEnd = this.shops.getBillingPeriodEnd(shop);
            return { currentPeriodEnd: periodEnd, planLabel };
        }
        return null;
    }
    async fetchAppSubscriptionStatusByGid(shopDomain, accessToken, gid) {
        const query = `query SubStatus($id: ID!) { node(id: $id) { ... on AppSubscription { status } } }`;
        const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
            body: JSON.stringify({ query, variables: { id: gid } }),
        });
        if (res.status === 401)
            this.throwReconnectRequired('fetchAppSubscriptionStatusByGid');
        if (!res.ok)
            return null;
        const data = (await res.json());
        if (data.errors?.length)
            return null;
        const st = data.data?.node?.status;
        return st ? String(st).toUpperCase() : null;
    }
    async cancelSubscription(shopDomain) {
        const normalized = this.normalizeDomain(shopDomain);
        const shop = await this.shops.getByDomain(normalized);
        const accessToken = this.shops.getAccessToken(shop);
        let active;
        try {
            active = await this.getActiveSubscriptionSnapshots(normalized, accessToken);
        }
        catch (e) {
            const grace = this.tryReturnGraceOnlyCancel(shop);
            if (grace) {
                console.warn('[Billing] cancelSubscription: could not list subscriptions; DB has grace — no-op', e);
                return grace;
            }
            throw e;
        }
        if (!active.length) {
            const grace = this.tryReturnGraceOnlyCancel(shop);
            if (grace)
                return grace;
            await this.shops.clearBilling(normalized, null, null);
            return { currentPeriodEnd: null, planLabel: '' };
        }
        const preferredId = shop.recurringChargeId?.trim()
            ? `gid://shopify/AppSubscription/${shop.recurringChargeId.replace(/\D/g, '') || shop.recurringChargeId}`
            : '';
        const target = active.find((s) => s.id === preferredId)
            ?? (shop.recurringChargeId?.trim()
                ? active.find((s) => this.parseSubscriptionId(s.id) === this.parseSubscriptionId(shop.recurringChargeId))
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
            throw new common_1.BadRequestException('Unable to cancel subscription. Please try again or cancel from Shopify Settings → Billing.');
        }
        const data = (await res.json());
        const errors = data.errors ?? data.data?.appSubscriptionCancel?.userErrors ?? [];
        if (errors.length) {
            const msg = errors.map((e) => e?.message ?? '').filter(Boolean).join('; ') || 'Subscription could not be cancelled.';
            const alreadyDone = /already|cancel(?:l)?ed|inactive|not active|expired|frozen|declined|ended|no longer|unable to cancel|duplicate|invalid subscription|not found|does not exist|access denied|must be active|not eligible/i.test(msg);
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
                throw new common_1.BadRequestException(msg);
            }
            if (alreadyDone)
                console.warn('[Billing] cancelSubscription already handled on Shopify side, clearing DB state');
        }
        const resolved = this.resolvePlanFromSnapshot(target);
        await this.shops.clearBilling(normalized, target.currentPeriodEnd ?? null, resolved.planLabel);
        return {
            currentPeriodEnd: target.currentPeriodEnd ?? null,
            planLabel: resolved.planLabel,
        };
    }
    async getActiveSubscriptionInfo(shopDomain) {
        const normalized = this.normalizeDomain(shopDomain);
        const shop = await this.shops.getByDomain(normalized);
        const accessToken = this.shops.getAccessToken(shop);
        const active = await this.getActiveSubscriptionSnapshots(normalized, accessToken);
        if (!active.length)
            return null;
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
    async getActiveSubscriptionSnapshots(shopDomain, accessToken) {
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
    allSubscriptions(first: 20) {
      id
      status
      currentPeriodEnd
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
            throw new common_1.BadRequestException('Unable to verify subscription.');
        }
        const data = (await res.json());
        if (data.errors?.length) {
            console.error('[Billing] GraphQL errors', data.errors);
            throw new common_1.BadRequestException('Unable to verify subscription.');
        }
        const installation = data.data?.currentAppInstallation;
        const subs = installation?.activeSubscriptions ?? [];
        const allById = new Map();
        for (const s of installation?.allSubscriptions ?? []) {
            const sid = s.id ?? '';
            const periodEnd = s.currentPeriodEnd ?? '';
            if (sid && periodEnd) {
                allById.set(sid, periodEnd);
            }
        }
        return subs
            .map((s) => ({
            id: s.id ?? '',
            name: s.name ?? null,
            status: s.status ?? null,
            createdAt: s.createdAt ?? null,
            currentPeriodEnd: s.currentPeriodEnd ?? allById.get(s.id ?? '') ?? null,
            interval: s.lineItems?.[0]?.plan?.pricingDetails?.interval ?? null,
            amount: s.lineItems?.[0]?.plan?.pricingDetails?.price?.amount != null
                ? Number(s.lineItems?.[0]?.plan?.pricingDetails?.price?.amount)
                : null,
        }))
            .filter((s) => Boolean(s.id));
    }
    pickPreferredActiveSubscription(active, preferredRecurringChargeId) {
        const preferredId = preferredRecurringChargeId?.trim()
            ? `gid://shopify/AppSubscription/${preferredRecurringChargeId.replace(/\D/g, '') || preferredRecurringChargeId}`
            : '';
        if (preferredId) {
            const exact = active.find((s) => s.id === preferredId);
            if (exact)
                return exact;
            const numeric = this.parseSubscriptionId(preferredRecurringChargeId);
            const byNumeric = active.find((s) => this.parseSubscriptionId(s.id) === numeric);
            if (byNumeric)
                return byNumeric;
        }
        const sorted = [...active].sort((a, b) => {
            const amountA = Number.isFinite(a.amount ?? NaN) ? Number(a.amount) : -1;
            const amountB = Number.isFinite(b.amount ?? NaN) ? Number(b.amount) : -1;
            if (amountA !== amountB)
                return amountB - amountA;
            const annualA = String(a.interval ?? '').toUpperCase() === 'ANNUAL' ? 1 : 0;
            const annualB = String(b.interval ?? '').toUpperCase() === 'ANNUAL' ? 1 : 0;
            if (annualA !== annualB)
                return annualB - annualA;
            const createdA = Date.parse(String(a.createdAt ?? ''));
            const createdB = Date.parse(String(b.createdAt ?? ''));
            return (Number.isNaN(createdB) ? 0 : createdB) - (Number.isNaN(createdA) ? 0 : createdA);
        });
        return sorted[0];
    }
    resolvePlanFromSnapshot(sub) {
        const name = String(sub.name ?? '').toLowerCase();
        if (name.includes('pro') && (name.includes('year') || name.includes('annual'))) {
            return { planKey: 'pro_annual', planLabel: 'Pro Annual' };
        }
        if (name.includes('pro'))
            return { planKey: 'pro', planLabel: 'Pro' };
        if (name.includes('starter'))
            return { planKey: 'starter', planLabel: 'Starter' };
        if (name.includes('growth'))
            return { planKey: 'growth', planLabel: 'Growth' };
        if (String(sub.interval).toUpperCase() === 'ANNUAL')
            return { planKey: 'pro_annual', planLabel: 'Pro Annual' };
        if (sub.amount === 290)
            return { planKey: 'pro_annual', planLabel: 'Pro Annual' };
        if (sub.amount === 29)
            return { planKey: 'pro', planLabel: 'Pro' };
        if (sub.amount === 19)
            return { planKey: 'growth', planLabel: 'Growth' };
        if (sub.amount === 9)
            return { planKey: 'starter', planLabel: 'Starter' };
        return { planKey: 'growth', planLabel: 'Growth' };
    }
    normalizeDomain(domain) {
        const d = domain.toLowerCase().trim();
        return d.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        shops_service_1.ShopsService])
], BillingService);
