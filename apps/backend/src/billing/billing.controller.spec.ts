import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ShopsService } from '../shops/shops.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

function createController(deps: {
  billing: Partial<Pick<BillingService, 'getActiveSubscriptionInfo' | 'createRecurringCharge'>>;
  shops: Partial<Pick<ShopsService, 'getByDomain' | 'setPaidPlan' | 'hasPaidPlan'>>;
  baseUrl?: string;
}) {
  const billing = deps.billing as BillingService;
  const shops = deps.shops as ShopsService;
  const config = {
    get: (k: string) => (k === 'SHOPIFY_APP_URL' ? deps.baseUrl ?? 'https://app.example.com' : undefined),
  } as ConfigService;
  return new BillingController(billing, config, shops);
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

    const res = { redirect: jest.fn() } as unknown as Response;
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

    const res = { redirect: jest.fn() } as unknown as Response;
    const c = createController({
      billing: { getActiveSubscriptionInfo, createRecurringCharge },
      shops: { getByDomain, setPaidPlan, hasPaidPlan },
    });

    await c.subscribe(shop, 'growth', res);

    expect(createRecurringCharge).toHaveBeenCalledWith(shop, 'growth');
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://billing.shopify.com/confirm');
  });

  it('falls through to create when live check throws', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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

    const res = { redirect: jest.fn() } as unknown as Response;
    const c = createController({
      billing: { getActiveSubscriptionInfo, createRecurringCharge },
      shops: { getByDomain, hasPaidPlan },
    });

    await c.subscribe(shop, 'pro', res);

    expect(createRecurringCharge).toHaveBeenCalledWith(shop, 'pro');
    errSpy.mockRestore();
  });
});
