"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const billing_controller_1 = require("./billing.controller");
function createController(deps) {
    const billing = deps.billing;
    const shops = deps.shops;
    const config = {
        get: (k) => (k === 'SHOPIFY_APP_URL' ? deps.baseUrl ?? 'https://app.example.com' : undefined),
    };
    return new billing_controller_1.BillingController(billing, config, shops);
}
describe('BillingController.subscribe', () => {
    const shop = 'test-store.myshopify.com';
    it('redirects same_plan and syncs DB when Shopify already has the requested plan (stale DB)', async () => {
        const getActiveSubscriptionInfo = jest.fn().mockResolvedValue({
            id: 'gid://shopify/AppSubscription/999',
            planKey: 'pro',
            planLabel: 'Pro',
            status: 'ACTIVE',
            currentPeriodEnd: '2026-12-01T00:00:00.000Z',
        });
        const createRecurringCharge = jest.fn();
        const setPaidPlan = jest.fn().mockResolvedValue(undefined);
        const getByDomain = jest.fn().mockResolvedValue({
            plan: 'growth',
            recurringChargeId: '1',
            domain: shop,
        });
        const hasPaidPlan = jest.fn().mockReturnValue(true);
        const res = { redirect: jest.fn() };
        const c = createController({
            billing: { getActiveSubscriptionInfo, createRecurringCharge },
            shops: { getByDomain, setPaidPlan, hasPaidPlan },
        });
        await c.subscribe(shop, 'pro', res);
        expect(createRecurringCharge).not.toHaveBeenCalled();
        expect(setPaidPlan).toHaveBeenCalledWith(shop, '999', 'pro', {
            currentPeriodEndIso: '2026-12-01T00:00:00.000Z',
        });
        expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('same_plan=1'));
    });
    it('calls createRecurringCharge when live plan differs from selection', async () => {
        const getActiveSubscriptionInfo = jest.fn().mockResolvedValue({
            id: 'gid://shopify/AppSubscription/999',
            planKey: 'pro',
            planLabel: 'Pro',
            status: 'ACTIVE',
            currentPeriodEnd: null,
        });
        const createRecurringCharge = jest.fn().mockResolvedValue({
            confirmationUrl: 'https://billing.shopify.com/confirm',
            chargeId: 1,
        });
        const setPaidPlan = jest.fn();
        const getByDomain = jest.fn().mockResolvedValue({
            plan: 'pro',
            recurringChargeId: '1',
            domain: shop,
        });
        const hasPaidPlan = jest.fn().mockReturnValue(true);
        const res = { redirect: jest.fn() };
        const c = createController({
            billing: { getActiveSubscriptionInfo, createRecurringCharge },
            shops: { getByDomain, setPaidPlan, hasPaidPlan },
        });
        await c.subscribe(shop, 'growth', res);
        expect(createRecurringCharge).toHaveBeenCalledWith(shop, 'growth');
        expect(res.redirect).toHaveBeenCalledWith(302, 'https://billing.shopify.com/confirm');
    });
    it('falls through to create when live check throws', async () => {
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const getActiveSubscriptionInfo = jest.fn().mockRejectedValue(new Error('network'));
        const createRecurringCharge = jest.fn().mockResolvedValue({
            confirmationUrl: 'https://billing.shopify.com/confirm',
            chargeId: 1,
        });
        const getByDomain = jest.fn().mockResolvedValue({
            plan: 'growth',
            recurringChargeId: '2',
            domain: shop,
        });
        const hasPaidPlan = jest.fn().mockReturnValue(true);
        const res = { redirect: jest.fn() };
        const c = createController({
            billing: { getActiveSubscriptionInfo, createRecurringCharge },
            shops: { getByDomain, hasPaidPlan },
        });
        await c.subscribe(shop, 'pro', res);
        expect(createRecurringCharge).toHaveBeenCalledWith(shop, 'pro');
        errSpy.mockRestore();
    });
});
