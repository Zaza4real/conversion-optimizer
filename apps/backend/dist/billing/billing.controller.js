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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const billing_service_1 = require("./billing.service");
const shops_service_1 = require("../shops/shops.service");
function logBillingError(step, err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Billing] ${step} failed:`, msg);
    if (err instanceof Error && err.stack)
        console.error(err.stack);
}
let BillingController = class BillingController {
    constructor(billing, config, shops) {
        this.billing = billing;
        this.config = config;
        this.shops = shops;
    }
    needsReconnect(err) {
        const msg = err instanceof Error ? err.message : String(err ?? '');
        return msg.includes('SHOP_RECONNECT_REQUIRED');
    }
    async status(shop) {
        const billingTestRaw = this.config.get('BILLING_TEST') ?? '';
        const testMode = /^(true|1)$/i.test(String(billingTestRaw).trim());
        if (!shop?.trim()) {
            return { subscribed: false, error: 'Missing shop', testMode };
        }
        const normalized = this.normalizeShop(shop.trim());
        try {
            const s = await this.shops.getByDomain(normalized);
            const subscribed = this.shops.hasPaidPlan(s);
            const baseUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
            const upgradeUrl = baseUrl ? `${baseUrl}/api/billing/subscribe?shop=${encodeURIComponent(s.domain)}` : undefined;
            return { subscribed, upgradeUrl: subscribed ? undefined : upgradeUrl, testMode };
        }
        catch {
            return { subscribed: false, error: 'Shop not found', testMode };
        }
    }
    async subscribe(shop, plan, res) {
        if (!shop?.trim()) {
            res.status(400).send('Missing query parameter: shop');
            return;
        }
        const normalized = this.normalizeShop(shop.trim());
        const planKey = this.resolvePlanKey(plan);
        const baseUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        try {
            try {
                const live = await this.billing.getActiveSubscriptionInfo(normalized);
                if (live && live.planKey === planKey) {
                    await this.shops.setPaidPlan(normalized, this.extractSubscriptionTailId(live.id), planKey, {
                        currentPeriodEndIso: live.currentPeriodEnd?.trim() || undefined,
                    });
                    const homeUrl = baseUrl
                        ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}&same_plan=1`
                        : `https://${normalized}/admin`;
                    res.redirect(302, homeUrl);
                    return;
                }
            }
            catch (syncErr) {
                if (this.needsReconnect(syncErr)) {
                    const reconnectUrl = baseUrl
                        ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}&reconnect=1`
                        : `https://${normalized}/admin`;
                    res.redirect(302, reconnectUrl);
                    return;
                }
                logBillingError('subscribe (live plan check)', syncErr);
            }
            const existing = await this.shops.getByDomain(normalized);
            const samePaidPlan = this.shops.hasPaidPlan(existing)
                && (existing.plan === planKey || (existing.plan === 'paid' && planKey === 'growth'));
            if (samePaidPlan) {
                const homeUrl = baseUrl
                    ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}&same_plan=1`
                    : `https://${normalized}/admin`;
                res.redirect(302, homeUrl);
                return;
            }
            const { confirmationUrl } = await this.billing.createRecurringCharge(normalized, planKey);
            res.redirect(302, confirmationUrl);
        }
        catch (err) {
            if (this.needsReconnect(err)) {
                const reconnectUrl = baseUrl
                    ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}&reconnect=1`
                    : `https://${normalized}/admin`;
                res.redirect(302, reconnectUrl);
                return;
            }
            logBillingError('subscribe', err);
            const appUrl = baseUrl ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}&billing_error=1` : `https://${normalized}/admin`;
            res.redirect(302, appUrl);
        }
    }
    async return(chargeId, subscriptionId, shop, plan, res) {
        const id = (chargeId ?? subscriptionId)?.trim();
        if (!id || !shop?.trim()) {
            res.status(400).send('Missing charge_id (or subscription_id) and shop');
            return;
        }
        const normalizedShop = this.normalizeShop(shop.trim());
        const planKey = this.resolvePlanKey(plan);
        const baseUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        try {
            await this.billing.confirmAndActivate(normalizedShop, id, planKey);
        }
        catch (err) {
            if (this.needsReconnect(err)) {
                const reconnectUrl = baseUrl
                    ? `${baseUrl}/?shop=${encodeURIComponent(normalizedShop)}&reconnect=1`
                    : `https://${normalizedShop}/admin`;
                res.redirect(302, reconnectUrl);
                return;
            }
            logBillingError('return (confirmAndActivate)', err);
            res.status(400).send('Billing activation failed. Please try again or contact support.');
            return;
        }
        const redirectTo = baseUrl
            ? `${baseUrl}/?shop=${encodeURIComponent(normalizedShop)}&billing_success=1&plan=${encodeURIComponent(planKey)}`
            : `https://${normalizedShop}/admin`;
        res.redirect(302, redirectTo);
    }
    async cancel(shop, res) {
        const baseUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        if (!shop?.trim()) {
            res.redirect(302, baseUrl ? `${baseUrl}/?billing_cancel_error=1` : '/');
            return;
        }
        const normalized = this.normalizeShop(shop.trim());
        const homeUrl = baseUrl ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}` : `https://${normalized}/admin`;
        try {
            const cancelled = await this.billing.cancelSubscription(normalized);
            const activeUntilParam = cancelled.currentPeriodEnd ? `&active_until=${encodeURIComponent(cancelled.currentPeriodEnd)}` : '';
            const cancelledPlanParam = cancelled.planLabel ? `&cancelled_plan=${encodeURIComponent(cancelled.planLabel)}` : '';
            res.redirect(302, `${baseUrl}/?shop=${encodeURIComponent(normalized)}&cancelled=1${activeUntilParam}${cancelledPlanParam}`);
        }
        catch (err) {
            if (this.needsReconnect(err)) {
                const reconnectUrl = baseUrl
                    ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}&reconnect=1`
                    : `https://${normalized}/admin`;
                res.redirect(302, reconnectUrl);
                return;
            }
            logBillingError('cancel', err);
            res.redirect(302, `${homeUrl}&billing_cancel_error=1`);
        }
    }
    normalizeShop(shop) {
        const s = shop.toLowerCase().trim().replace(/%2E/g, '.').replace(/^https?:\/\//, '').split('/')[0];
        return s.includes('.myshopify.com') ? s : `${s}.myshopify.com`;
    }
    resolvePlanKey(plan) {
        const key = (plan ?? '').toLowerCase().trim();
        if (key === 'starter' || key === 'growth' || key === 'pro' || key === 'pro_annual') {
            return key;
        }
        return 'growth';
    }
    extractSubscriptionTailId(gid) {
        const m = String(gid).match(/(\d+)$/);
        return m ? m[1] : String(gid);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Query)('shop')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('subscribe'),
    __param(0, (0, common_1.Query)('shop')),
    __param(1, (0, common_1.Query)('plan')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Get)('return'),
    __param(0, (0, common_1.Query)('charge_id')),
    __param(1, (0, common_1.Query)('subscription_id')),
    __param(2, (0, common_1.Query)('shop')),
    __param(3, (0, common_1.Query)('plan')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "return", null);
__decorate([
    (0, common_1.Get)('cancel'),
    __param(0, (0, common_1.Query)('shop')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "cancel", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_service_1.BillingService,
        config_1.ConfigService,
        shops_service_1.ShopsService])
], BillingController);
