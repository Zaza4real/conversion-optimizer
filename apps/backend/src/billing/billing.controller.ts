import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { BillingService } from './billing.service';
import { ShopsService } from '../shops/shops.service';

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
    if (!shop?.trim()) {
      return { subscribed: false, error: 'Missing shop' };
    }
    const normalized = shop.trim().toLowerCase().replace(/%2E/g, '.');
    try {
      const s = await this.shops.getByDomain(normalized);
      const subscribed = this.shops.hasPaidPlan(s);
      const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
      const upgradeUrl = baseUrl ? `${baseUrl}/api/billing/subscribe?shop=${encodeURIComponent(s.domain)}` : undefined;
      return { subscribed, upgradeUrl: subscribed ? undefined : upgradeUrl };
    } catch {
      return { subscribed: false, error: 'Shop not found' };
    }
  }

  /**
   * GET /api/billing/subscribe?shop=example.myshopify.com
   * Creates a $19/month recurring charge and redirects the merchant to Shopify's confirmation page.
   */
  @Get('subscribe')
  async subscribe(
    @Query('shop') shop: string | undefined,
    @Res() res: Response,
  ) {
    if (!shop?.trim()) {
      res.status(400).send('Missing query parameter: shop');
      return;
    }
    const { confirmationUrl } = await this.billing.createRecurringCharge(shop.trim());
    res.redirect(302, confirmationUrl);
  }

  /**
   * GET /api/billing/return?charge_id=123&shop=example.myshopify.com
   * Shopify redirects here after the merchant approves the charge. We confirm/activate and mark the shop as paid.
   */
  @Get('return')
  async return(
    @Query('charge_id') chargeId: string | undefined,
    @Query('shop') shop: string | undefined,
    @Res() res: Response,
  ) {
    if (!chargeId?.trim() || !shop?.trim()) {
      res.status(400).send('Missing charge_id or shop');
      return;
    }
    try {
      await this.billing.confirmAndActivate(shop.trim(), chargeId.trim());
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Activation failed';
      res.status(400).send(`Billing activation failed: ${message}`);
      return;
    }
    // Redirect back to the app root (Shopify will load the app in admin).
    const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    const redirectTo = baseUrl
      ? `${baseUrl}/?shop=${encodeURIComponent(shop.trim())}`
      : `https://${shop.trim()}/admin`;
    res.redirect(302, redirectTo);
  }
}
