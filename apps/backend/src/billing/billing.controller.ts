import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { BillingService } from './billing.service';
import { ShopsService } from '../shops/shops.service';

function logBillingError(step: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[Billing] ${step} failed:`, msg);
  if (err instanceof Error && err.stack) console.error(err.stack);
}

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
    private readonly shops: ShopsService,
  ) {}

  /**
   * GET /api/billing/status?shop=example.myshopify.com
   * Returns whether the shop has an active subscription and the upgrade URL if not.
   */
  @Get('status')
  async status(@Query('shop') shop: string | undefined) {
    const billingTestRaw = this.config.get<string>('BILLING_TEST') ?? '';
    const testMode = /^(true|1)$/i.test(String(billingTestRaw).trim());
    if (!shop?.trim()) {
      return { subscribed: false, error: 'Missing shop', testMode };
    }
    const normalized = this.normalizeShop(shop.trim());
    try {
      const s = await this.shops.getByDomain(normalized);
      const subscribed = this.shops.hasPaidPlan(s);
      const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
      const upgradeUrl = baseUrl ? `${baseUrl}/api/billing/subscribe?shop=${encodeURIComponent(s.domain)}` : undefined;
      return { subscribed, upgradeUrl: subscribed ? undefined : upgradeUrl, testMode };
    } catch {
      return { subscribed: false, error: 'Shop not found', testMode };
    }
  }

  /**
   * GET /api/billing/subscribe?shop=...&plan=starter|growth|pro
   * Creates a recurring charge for the chosen plan and redirects to Shopify's confirmation page.
   */
  @Get('subscribe')
  async subscribe(
    @Query('shop') shop: string | undefined,
    @Query('plan') plan: string | undefined,
    @Res() res: Response,
  ) {
    if (!shop?.trim()) {
      res.status(400).send('Missing query parameter: shop');
      return;
    }
    const normalized = this.normalizeShop(shop.trim());
    const planKey = (plan?.toLowerCase() === 'starter' || plan?.toLowerCase() === 'pro' ? plan.toLowerCase() : 'growth') as 'starter' | 'growth' | 'pro';
    const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    try {
      const { confirmationUrl } = await this.billing.createRecurringCharge(normalized, planKey);
      res.redirect(302, confirmationUrl);
    } catch (err) {
      logBillingError('subscribe', err);
      const appUrl = baseUrl ? `${baseUrl}/?shop=${encodeURIComponent(normalized)}&billing_error=1` : `https://${normalized}/admin`;
      res.redirect(302, appUrl);
    }
  }

  /**
   * GET /api/billing/return?charge_id=...&shop=...&plan=starter|growth|pro
   * Shopify redirects here after the merchant approves. We confirm and store the plan.
   */
  @Get('return')
  async return(
    @Query('charge_id') chargeId: string | undefined,
    @Query('subscription_id') subscriptionId: string | undefined,
    @Query('shop') shop: string | undefined,
    @Query('plan') plan: string | undefined,
    @Res() res: Response,
  ) {
    const id = (chargeId ?? subscriptionId)?.trim();
    if (!id || !shop?.trim()) {
      res.status(400).send('Missing charge_id (or subscription_id) and shop');
      return;
    }
    const normalizedShop = this.normalizeShop(shop.trim());
    const planKey = (plan?.toLowerCase() === 'starter' || plan?.toLowerCase() === 'pro' ? plan.toLowerCase() : 'growth') as 'starter' | 'growth' | 'pro';
    try {
      await this.billing.confirmAndActivate(normalizedShop, id, planKey);
    } catch (err) {
      logBillingError('return (confirmAndActivate)', err);
      res.status(400).send('Billing activation failed. Please try again or contact support.');
      return;
    }
    // Redirect back to the app with thank-you state (Shopify will load the app in admin).
    const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    const redirectTo = baseUrl
      ? `${baseUrl}/?shop=${encodeURIComponent(normalizedShop)}&billing_success=1&plan=${encodeURIComponent(planKey)}`
      : `https://${normalizedShop}/admin`;
    res.redirect(302, redirectTo);
  }

  private normalizeShop(shop: string): string {
    const s = shop.toLowerCase().trim().replace(/%2E/g, '.').replace(/^https?:\/\//, '').split('/')[0];
    return s.includes('.myshopify.com') ? s : `${s}.myshopify.com`;
  }
}
