import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as path from 'path';
import { ShopsService } from '../shops/shops.service';

/**
 * Handles GET / (Shopify app load in Admin iframe). Excluded from global "api" prefix.
 * - ?debug=1: return JSON with clientIdPreview so you can verify Railway has the right SHOPIFY_API_KEY.
 * - If shop not installed: serve HTML that redirects the top window to OAuth (break out of iframe).
 * - If shop installed: serve a minimal app home so the iframe shows content (avoids redirect loop).
 */
@Controller()
export class RootController {
  constructor(
    private readonly shops: ShopsService,
    private readonly config: ConfigService,
  ) {}

  /** Serve app favicon (SVG) at /favicon.ico for browser tab icon — crisp at any size */
  @Get('favicon.ico')
  favicon(@Res() res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/svg+xml');
    const faviconPath = path.join(__dirname, '..', '..', 'public', 'favicon.svg');
    res.sendFile(faviconPath, (err: Error) => {
      if (err) res.status(204).send();
    });
  }

  /** GET /health — Readiness for load balancers and reviewers. */
  @Get('health')
  health(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ status: 'ok', app: 'Conversion Optimizer' }));
  }

  /** GET /privacy — Privacy policy (for Shopify Partners App setup). ?return_to=URL used for "Back" link. */
  @Get('privacy')
  privacy(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const backUrl = this.getBackUrlFromRequest(req);
    res.send(this.getPolicyHtml('Privacy Policy', this.getPrivacyContent(), backUrl));
  }

  /** GET /refund — Refund and cancellation policy (for Shopify Partners App setup). ?return_to=URL used for "Back" link. */
  @Get('refund')
  refund(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const backUrl = this.getBackUrlFromRequest(req);
    res.send(this.getPolicyHtml('Refund & Cancellation Policy', this.getRefundContent(), backUrl));
  }

  /** GET /support — Support and contact page (Pro 24/7 support). ?return_to=URL used for "Back" link. */
  @Get('support')
  support(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const backUrl = this.getBackUrlFromRequest(req);
    res.send(this.getSupportPageHtml(backUrl));
  }

  /** GET /landing — Premium marketing landing page for the app (store owners, not product catalog). */
  @Get('landing')
  landing(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const baseUrl = this.getBaseUrl(req);
    const appStoreUrl = this.config.get<string>('APP_STORE_LISTING_URL') || '#';
    res.send(this.getLandingPageHtml(baseUrl, appStoreUrl));
  }

  /** GET /scan/run?shop=... — Styled page: run scan and show result (no raw JSON). */
  @Get('scan/run')
  scanRunPage(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();
    if (!shop) {
      res.status(400).send('Missing shop parameter');
      return;
    }
    const baseUrl = this.getBaseUrl(req);
    const normalized = this.normalizeShop(shop);
    const shopEnc = encodeURIComponent(normalized);
    const apiUrl = `${baseUrl}/api/scan/${shopEnc}`;
    const homeUrl = `${baseUrl}/?shop=${encodeURIComponent(normalized)}`;
    const recsUrl = `${baseUrl}/recommendations?shop=${shopEnc}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.getScanRunPageHtml(normalized, apiUrl, homeUrl, recsUrl));
  }

  /** GET /billing/cancel-confirm?shop=... — Confirm before cancelling subscription (then call API to cancel). */
  @Get('billing/cancel-confirm')
  billingCancelConfirm(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();
    if (!shop) {
      res.status(400).send('Missing shop');
      return;
    }
    const baseUrl = this.getBaseUrl(req);
    const normalized = this.normalizeShop(shop);
    const shopEnc = encodeURIComponent(normalized);
    const homeUrl = `${baseUrl}/?shop=${shopEnc}`;
    const cancelUrl = `${baseUrl}/api/billing/cancel?shop=${shopEnc}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(this.getBillingCancelConfirmHtml(baseUrl, homeUrl, cancelUrl));
  }

  /** GET /billing/confirm?shop=...&plan=growth|pro — Professional confirmation before redirecting to Shopify checkout. */
  @Get('billing/confirm')
  billingConfirm(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();
    const plan = (req.query.plan as string)?.toLowerCase().trim();
    if (!shop || !plan) {
      res.status(400).send('Missing shop or plan');
      return;
    }
    const baseUrl = this.getBaseUrl(req);
    const normalized = this.normalizeShop(shop);
    const shopEnc = encodeURIComponent(normalized);
    const homeUrl = `${baseUrl}/?shop=${shopEnc}`;
    const subscribeUrl = `${baseUrl}/api/billing/subscribe?shop=${shopEnc}&plan=${encodeURIComponent(plan)}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(this.getBillingConfirmHtml(plan, baseUrl, homeUrl, subscribeUrl));
  }

  /** GET /recommendations?shop=... — Styled page: fetch and display recommendations (no raw JSON). */
  @Get('recommendations')
  recommendationsPage(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();
    if (!shop) {
      res.status(400).send('Missing shop parameter');
      return;
    }
    const baseUrl = this.getBaseUrl(req);
    const normalized = this.normalizeShop(shop);
    const shopEnc = encodeURIComponent(normalized);
    const apiUrl = `${baseUrl}/api/recommendations/${shopEnc}?limit=50`;
    const homeUrl = `${baseUrl}/?shop=${encodeURIComponent(normalized)}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.getRecommendationsPageHtml(normalized, apiUrl, homeUrl));
  }

  @Get()
  async index(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();

    if (String(req.query.debug) === '1') {
      const clientId = this.config.get<string>('SHOPIFY_API_KEY') ?? '';
      const preview = clientId.length >= 4 ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : '(not set)';
      res.setHeader('Content-Type', 'application/json');
      res.send(
        JSON.stringify({
          clientIdPreview: preview,
          message: 'Set SHOPIFY_API_KEY in Railway to your app Client ID (Partners/Dev Dashboard → Settings). Use /api/auth/forget?shop=... then open the app to refresh the token.',
        }),
      );
      return;
    }

    if (!shop) {
      const baseUrl = this.getBaseUrl(req);
      const appStoreUrl = this.config.get<string>('APP_STORE_LISTING_URL') || '#';
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(this.getLandingPageHtml(baseUrl, appStoreUrl));
      return;
    }
    const normalized = this.normalizeShop(shop);
    const existing = await this.shops.findByDomain(normalized);
    const baseUrl = this.getBaseUrl(req);

    // Force OAuth when: no shop, shop was uninstalled, or ?reconnect=1 (e.g. after switching to a new app)
    const forceReauth =
      !existing ||
      existing.uninstalledAt != null ||
      String(req.query.reconnect).toLowerCase() === '1';
    if (forceReauth) {
      const query = new URLSearchParams(req.query as Record<string, string>).toString();
      const authUrl = `${baseUrl}/api/auth?${query}`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conversion Optimizer</title></head><body><p>Loading Conversion Optimizer…</p><script>window.top.location.href=${JSON.stringify(authUrl)};</script></body></html>`,
      );
      return;
    }

    const hasPlan = this.shops.hasPaidPlan(existing);
    const currentPlanLabel = this.shops.getPlanLabel(existing);
    const billingError = String(req.query.billing_error) === '1';
    const billingSuccess = String(req.query.billing_success) === '1';
    const planJustPurchased = (req.query.plan as string)?.trim() || '';
    const cancelled = String(req.query.cancelled) === '1';
    const billingCancelError = String(req.query.billing_cancel_error) === '1';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const appStoreListingUrl = this.config.get<string>('APP_STORE_LISTING_URL');
    res.send(this.getAppHomeHtml(normalized, hasPlan, currentPlanLabel, baseUrl, billingError, appStoreListingUrl, billingSuccess, planJustPurchased, cancelled, billingCancelError));
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** App Bridge script from Shopify CDN (required for embedded app checks). Must be first in <head>. */
  private getAppBridgeHead(): string {
    const apiKey = this.config.get<string>('SHOPIFY_API_KEY')?.trim();
    if (!apiKey) return '';
    return `<link rel="preconnect" href="https://cdn.shopify.com"><meta name="shopify-api-key" content="${this.escapeHtml(apiKey)}">\n  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`;
  }

  private getAppHomeHtml(shop: string, hasPlan: boolean, currentPlanLabel: string, baseUrl: string, billingError = false, appStoreListingUrl?: string, billingSuccess = false, planJustPurchased = '', cancelled = false, billingCancelError = false): string {
    const title = 'Conversion Optimizer';
    const shopSafe = this.escapeHtml(shop);
    const shopEnc = encodeURIComponent(shop);
    const statusUrl = `${baseUrl}/api/billing/status?shop=${shopEnc}`;
    const scanRunUrl = `${baseUrl}/scan/run?shop=${shopEnc}`;
    const recsPageUrl = `${baseUrl}/recommendations?shop=${shopEnc}`;
    const subscribeBase = `${baseUrl}/api/billing/subscribe?shop=${shopEnc}`;
    const confirmBase = `${baseUrl}/billing/confirm?shop=${shopEnc}`;
    const cancelConfirmUrl = `${baseUrl}/billing/cancel-confirm?shop=${shopEnc}`;

    const plansDisplay = [
      { key: 'growth', name: 'Growth', price: 19, desc: 'Full access: store scan, recommendations, filter by severity, export CSV. Best for growing stores.' },
      { key: 'pro', name: 'Pro', price: 29, desc: 'Premium with 24/7 support. Everything in Growth, plus priority help and dedicated support for teams and high-volume stores.', popular: true },
    ];

    const billingSuccessBanner = billingSuccess
      ? this.getThankYouBanner(planJustPurchased)
      : '';
    const cancelledBanner = cancelled
      ? '<div class="card card-success"><p class="card-text">Your subscription has been cancelled. You have access until the end of your current billing period.</p></div>'
      : '';
    const billingCancelErrorBanner = billingCancelError
      ? '<div class="card card-error"><p class="card-text">We couldn\'t cancel your subscription. Please try again or contact support.</p></div>'
      : '';
    const billingBanner = billingError
      ? (hasPlan
          ? `<div class="card card-error"><p class="card-text">We couldn't complete your plan change. Your current <strong>${this.escapeHtml(currentPlanLabel)}</strong> plan is still active. Please try again or contact support.</p></div>`
          : '<div class="card card-error"><p class="card-text">Subscription could not be started. Please try again or contact support.</p></div>')
      : '';
    const billingCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Billing</h2><p class="card-text">Your plan: <strong>${this.escapeHtml(currentPlanLabel)}</strong>. Full access to scans and recommendations.</p><p class="card-text" style="margin-bottom:14px;">You can cancel anytime; you'll keep access until the end of your billing period.</p><div class="billing-actions"><a href="${subscribeBase}" target="_top" class="btn btn-outline">Manage billing</a><a href="${this.escapeHtml(cancelConfirmUrl)}" target="_top" class="btn btn-outline">Cancel subscription</a></div></div>`
      : '';
    const plansCard = `<div class="card"><h2 class="card-title">Plans</h2><p class="card-text plans-intro">${hasPlan ? 'Change plan or manage billing below. ' : ''}Cancel anytime from the app or your Shopify billing.</p><div class="plans-grid">${plansDisplay.map((p) => `<div class="plan-card${p.popular ? ' plan-popular' : ''}"><div class="plan-name">${p.name}</div><div class="plan-price">$${p.price}<span class="plan-period">/mo</span></div><p class="plan-desc">${p.desc}</p><div class="plan-btn-wrap"><a href="${confirmBase}&plan=${p.key}" target="_top" class="btn btn-plan">${hasPlan ? 'Switch to ' + p.name : 'Subscribe'}</a></div></div>`).join('')}</div></div>`;
    const ctaCard = billingCard + plansCard;

    const actionsCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Actions</h2><div class="action-list"><div class="action-item"><a href="${scanRunUrl}" target="_top" class="btn btn-primary">Run scan</a><span class="action-desc">Analyze your store and generate CRO recommendations</span></div><div class="action-item"><a href="${recsPageUrl}" target="_top" class="btn btn-outline">View recommendations</a><span class="action-desc">See your CRO recommendations in a clear list</span></div></div></div>`
      : '<div class="card"><p class="card-text muted">Run scan and View recommendations unlock after you subscribe.</p></div>';

    const featuresHtml = `
    <div class="features-section">
      <h2 class="section-heading">What you get</h2>
      <p class="section-lead">One scan gives you a clear, prioritized list of fixes so your store converts better and sells more.</p>
      <ul class="feature-list">
        <li><strong>Store scan</strong> — We analyze your products (titles, descriptions, images, variants), theme, trust signals, and pricing so nothing is missed.</li>
        <li><strong>Prioritized list</strong> — Every recommendation is tagged high, medium, or low severity so you fix what matters first.</li>
        <li><strong>Actionable rationales</strong> — Each item explains exactly what to change and why it impacts conversion.</li>
        <li><strong>Filter & export</strong> — Filter by severity and export to CSV to share with your team or work through in your own time.</li>
        <li><strong>Ongoing value</strong> — Re-run the scan anytime after you improve your store to see progress and find the next wins.</li>
      </ul>
    </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.55; color: #202223; background: #f9fafb; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; }
    .app-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .app-logo-icon { height: 28px; width: 28px; display: block; flex-shrink: 0; }
    .app-wordmark { font-size: 17px; font-weight: 600; color: #202223; letter-spacing: -0.02em; }
    .shop-badge { font-size: 12px; color: #6d7175; font-weight: 500; }
    .hero-line { font-size: 15px; color: #334155; margin: 0 0 28px 0; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; line-height: 1.6; }
    .hero-line strong { font-weight: 600; color: #202223; }
    .features-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; margin-bottom: 20px; }
    .section-heading { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6d7175; margin: 0 0 8px 0; }
    .section-lead { font-size: 14px; color: #334155; margin: 0 0 16px 0; line-height: 1.55; }
    .feature-list { margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.65; }
    .feature-list li { margin-bottom: 10px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 22px; margin-bottom: 18px; }
    .card-error { border-color: #d72c0d; background: #fef2f2; }
    .card-success { border-color: #86efac; background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%); padding: 24px; }
    .card-success-icon { width: 36px; height: 36px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; margin-bottom: 10px; }
    .card-success-title { color: #166534; font-size: 14px; letter-spacing: 0.02em; }
    .card-title { font-size: 12px; font-weight: 600; margin: 0 0 10px 0; color: #202223; letter-spacing: 0.05em; text-transform: uppercase; }
    .card-text { margin: 0 0 14px 0; color: #6d7175; font-size: 14px; }
    .card-text.plans-intro { margin-bottom: 18px; }
    .card-text.muted { margin: 0; }
    .btn { display: inline-block; padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-family: inherit; text-align: center; }
    .btn-primary { background: #008060; color: #fff; }
    .btn-primary:hover { background: #006e52; }
    .btn-outline { background: #fff; color: #202223; border: 1px solid #c9cccf; }
    .btn-outline:hover { background: #f6f6f7; }
    .btn-plan { width: 100%; background: #008060; color: #fff; padding: 12px 16px; }
    .btn-plan:hover { background: #006e52; }
    .plans-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; align-items: stretch; }
    .plan-card { display: flex; flex-direction: column; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 22px; }
    .plan-card.plan-popular { border-color: #008060; border-width: 2px; background: #fafbfc; box-shadow: 0 2px 8px rgba(0,128,96,.08); }
    .plan-name { font-size: 14px; font-weight: 600; color: #202223; margin-bottom: 6px; }
    .plan-price { font-size: 26px; font-weight: 700; color: #008060; letter-spacing: -0.02em; }
    .plan-period { font-size: 14px; font-weight: 400; color: #6d7175; }
    .plan-desc { font-size: 13px; color: #475569; line-height: 1.5; margin: 12px 0 0 0; flex: 1; }
    .plan-btn-wrap { margin-top: 20px; }
    .action-list { display: flex; flex-direction: column; gap: 12px; }
    .action-item { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .action-desc { font-size: 13px; color: #6d7175; }
    .billing-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6d7175; }
    .footer a { color: #008060; text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; }
    @media (max-width: 480px) { .plans-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <header class="app-header">
      <div class="brand"><img src="/logo.svg" alt="" class="app-logo-icon"><span class="app-wordmark">${title}</span></div>
      <span class="shop-badge">${shopSafe}</span>
    </header>
    ${billingSuccessBanner}
    ${cancelledBanner}
    ${billingCancelErrorBanner}
    ${billingBanner}
    <p class="hero-line"><strong>Conversion Optimizer</strong> gives you a prioritized list of changes to improve your store. Run a scan, then work through recommendations by severity.</p>
    ${featuresHtml}
    ${ctaCard}
    ${actionsCard}
    <footer class="footer">
      <a href="${statusUrl}" target="_top">Billing status</a>${appStoreListingUrl ? ` &middot; <a href="${this.escapeHtml(appStoreListingUrl)}" target="_blank" rel="noopener">Leave a review</a>` : ''}
    </footer>
  </div>
</body>
</html>`;
  }

  private getThankYouBanner(planKey: string): string {
    const planName = planKey === 'pro' ? 'Pro' : planKey === 'starter' ? 'Starter' : 'Growth';
    return `
    <div class="card card-success">
      <div class="card-success-icon" aria-hidden="true">✓</div>
      <h2 class="card-title card-success-title">Thank you for your purchase</h2>
      <p class="card-text">Your <strong>${this.escapeHtml(planName)}</strong> plan is now active. You have full access to store scans and recommendations. We're glad to have you on board.</p>
    </div>`;
  }

  private getBillingConfirmHtml(planKey: string, baseUrl: string, homeUrl: string, subscribeUrl: string): string {
    const planName = planKey === 'pro' ? 'Pro' : planKey === 'starter' ? 'Starter' : 'Growth';
    const price = planKey === 'pro' ? 29 : planKey === 'starter' ? 9 : 19;
    const title = 'Conversion Optimizer';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>Confirm subscription — ${this.escapeHtml(planName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.55; color: #202223; background: #f9fafb; min-height: 100vh; }
    .container { max-width: 520px; margin: 0 auto; }
    .confirm-header { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
    .app-logo-icon { height: 28px; width: 28px; display: block; flex-shrink: 0; }
    .app-wordmark { font-size: 17px; font-weight: 600; color: #202223; letter-spacing: -0.02em; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
    .card-confirm-title { font-size: 18px; font-weight: 600; color: #202223; margin: 0 0 8px 0; }
    .card-confirm-plan { font-size: 22px; font-weight: 700; color: #008060; margin: 0 0 16px 0; }
    .card-confirm-desc { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
    .card-confirm-note { font-size: 13px; color: #6d7175; background: #f9fafb; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; line-height: 1.5; }
    .btn-wrap { display: flex; flex-direction: column; gap: 12px; }
    .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-family: inherit; text-align: center; }
    .btn-primary { background: #008060; color: #fff; }
    .btn-primary:hover { background: #006e52; }
    .btn-outline { background: #fff; color: #202223; border: 1px solid #c9cccf; }
    .btn-outline:hover { background: #f6f6f7; }
    .card-success { border-color: #86efac; background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%); }
    .card-success-icon { width: 40px; height: 40px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    .card-success-title { color: #166534; }
  </style>
</head>
<body>
  <div class="container">
    <header class="confirm-header">
      <img src="/logo.svg" alt="" class="app-logo-icon">
      <span class="app-wordmark">${title}</span>
    </header>
    <div class="card">
      <h1 class="card-confirm-title">Confirm your subscription</h1>
      <p class="card-confirm-plan">${this.escapeHtml(planName)} — $${price}/month</p>
      <p class="card-confirm-desc">You will be redirected to Shopify to complete the payment securely. Your subscription will appear on your next Shopify bill.</p>
      <p class="card-confirm-note">You can cancel anytime from your Shopify Admin under Settings → Billing. No long-term commitment required.</p>
      <div class="btn-wrap">
        <a href="${subscribeUrl}" target="_top" class="btn btn-primary">Continue to checkout</a>
        <a href="${homeUrl}" target="_top" class="btn btn-outline">Back to plans</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getBillingCancelConfirmHtml(baseUrl: string, homeUrl: string, cancelUrl: string): string {
    const title = 'Conversion Optimizer';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>Cancel subscription — ${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.55; color: #202223; background: #f9fafb; min-height: 100vh; }
    .container { max-width: 520px; margin: 0 auto; }
    .confirm-header { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
    .app-logo-icon { height: 28px; width: 28px; display: block; flex-shrink: 0; }
    .app-wordmark { font-size: 17px; font-weight: 600; color: #202223; letter-spacing: -0.02em; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
    .card-confirm-title { font-size: 18px; font-weight: 600; color: #202223; margin: 0 0 8px 0; }
    .card-confirm-desc { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
    .btn-wrap { display: flex; flex-direction: column; gap: 12px; }
    .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-family: inherit; text-align: center; }
    .btn-primary { background: #d72c0d; color: #fff; }
    .btn-primary:hover { background: #b71c0d; }
    .btn-outline { background: #fff; color: #202223; border: 1px solid #c9cccf; }
    .btn-outline:hover { background: #f6f6f7; }
  </style>
</head>
<body>
  <div class="container">
    <header class="confirm-header">
      <img src="/logo.svg" alt="" class="app-logo-icon">
      <span class="app-wordmark">${title}</span>
    </header>
    <div class="card">
      <h1 class="card-confirm-title">Cancel your subscription?</h1>
      <p class="card-confirm-desc">You'll keep access until the end of your current billing period. After that, you won't be charged and you can resubscribe anytime.</p>
      <div class="btn-wrap">
        <a href="${cancelUrl}" target="_top" class="btn btn-primary">Yes, cancel my subscription</a>
        <a href="${homeUrl}" target="_top" class="btn btn-outline">Keep my subscription</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getBaseStyles(): string {
    return `*{box-sizing:border-box}body{margin:0;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.55;color:#202223;background:#f6f6f7;min-height:100vh}.container{max-width:680px;margin:0 auto}.page-header{margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid #e1e3e5}.page-header-with-logo{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.page-header-with-logo .logo-link{text-decoration:none;display:flex;align-items:center;gap:8px}.page-header-with-logo .app-logo-small{height:24px;width:24px;display:block;flex-shrink:0}.page-header-with-logo .app-wordmark-sub{font-size:15px;font-weight:600;color:#202223}.page-title{font-size:24px;font-weight:600;margin:0 0 6px 0;color:#202223;letter-spacing:-0.02em}.page-subtitle{font-size:13px;color:#6d7175;margin:0}.card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:24px;margin-bottom:20px;border:1px solid rgba(0,0,0,.04)}.card-title{font-size:15px;font-weight:600;margin:0 0 12px 0;color:#202223}.card-text{margin:0 0 20px 0;color:#6d7175;font-size:14px}.btn{display:inline-block;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;border:none;cursor:pointer;font-family:inherit;transition:background .15s}.btn-primary{background:#008060;color:#fff}.btn-primary:hover{background:#006e52}.btn-secondary{background:#f6f6f7;color:#202223;border:1px solid #c9cccf}.btn-secondary:hover{background:#e1e3e5}.btn:disabled{opacity:.6;cursor:not-allowed}.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e1e3e5;font-size:13px;color:#6d7175}.footer a{color:#008060;text-decoration:none;font-weight:500}.footer a:hover{text-decoration:underline}.muted{color:#6d7175}.hero{font-size:15px;color:#202223;margin:0 0 20px 0;line-height:1.6}.steps{margin:0 0 24px 0;padding-left:20px}.steps li{margin-bottom:8px;color:#6d7175}.success-card{background:linear-gradient(180deg,#f0fdf4 0%,#fff 100%);border:1px solid #86efac;padding:20px;border-radius:10px;margin-top:20px}.success-card .title{font-size:15px;font-weight:600;color:#166534;margin:0 0 8px 0}.success-card .detail{font-size:12px;color:#6d7175;font-family:ui-monospace,monospace;word-break:break-all;margin:8px 0 16px 0}.success-card .next{font-size:13px;color:#6d7175;margin:0 0 12px 0}.result-box{background:#f9fafb;border:1px solid #e1e3e5;border-radius:8px;padding:20px;margin-top:20px;font-size:13px;word-break:break-all}.result-box a{color:#008060;text-decoration:none;font-weight:500}.result-box a:hover{text-decoration:underline}.intro-block{margin-bottom:24px;padding:16px 20px;background:#f9fafb;border-radius:8px;border-left:4px solid #008060}.intro-block .intro-title{font-size:13px;font-weight:600;color:#202223;margin:0 0 6px 0}.intro-block .intro-text{font-size:13px;color:#6d7175;margin:0;line-height:1.5}.scan-lead{margin:0 0 20px 0;font-size:14px;color:#202223;line-height:1.5}.scan-what-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#6d7175;margin:0 0 10px 0}.scan-what-list{margin:0 0 20px 0;padding-left:20px;font-size:13px;color:#44474a;line-height:1.6}.scan-what-list li{margin-bottom:6px}.scan-steps{margin:0 0 20px 0;font-size:13px;color:#6d7175;line-height:1.5}.table-wrap{overflow-x:auto;margin-top:16px}.table{width:100%;border-collapse:collapse;font-size:13px}.table th,.table td{padding:12px 16px;text-align:left;border-bottom:1px solid #e1e3e5}.table th{font-weight:600;color:#202223;background:#fafbfb;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.table tr:hover{background:#f9fafb}.table td{vertical-align:top}.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}.badge-high{background:#fef2f2;color:#b91c1c}.badge-medium{background:#fffbeb;color:#b45309}.badge-low{background:#f0fdf4;color:#15803d}.empty{text-align:center;padding:48px 24px;color:#6d7175}.empty .empty-title{font-size:15px;font-weight:600;color:#202223;margin:0 0 8px 0}.empty .empty-text{font-size:14px;margin:0;line-height:1.5}.count-bar{font-size:13px;color:#6d7175;margin-bottom:12px}.count-bar strong{color:#202223}.rec-intro{margin:0 0 20px 0;font-size:14px;color:#44474a;line-height:1.5}.rec-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e1e3e5}.rec-summary{font-size:13px;color:#6d7175;flex:1;min-width:120px}.rec-filters{display:flex;gap:6px}.filter-btn{padding:6px 12px;border:1px solid #c9cccf;background:#fff;border-radius:6px;font-size:12px;cursor:pointer;color:#44474a;font-family:inherit}.filter-btn:hover{background:#f6f6f7}.filter-btn.active{background:#202223;color:#fff;border-color:#202223}.btn-sm{padding:6px 12px;font-size:12px}.rec-list{display:flex;flex-direction:column;gap:16px}.rec-card{background:#fafbfb;border:1px solid #e1e3e5;border-radius:8px;padding:18px}.rec-card-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.rec-title{font-size:14px;font-weight:600;color:#202223}.rec-category{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6d7175;display:block;margin-bottom:10px}.rec-rationale{font-size:13px;color:#44474a;line-height:1.6;margin:0 0 8px 0}.rec-impact{font-size:12px;color:#008060;margin:0;font-weight:500}`;
  }

  private getScanRunPageHtml(shop: string, apiUrl: string, homeUrl: string, recsUrl: string): string {
    const recsEsc = recsUrl.replace(/'/g, "\\'");
    return `<!DOCTYPE html>
<html lang="en">
<head>${this.getAppBridgeHead()}<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Run scan — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <header class="page-header page-header-with-logo">
      <a href="${homeUrl}" target="_top" class="logo-link"><img src="/logo.svg" alt="" class="app-logo-small"><span class="app-wordmark-sub">Conversion Optimizer</span></a>
      <div><h1 class="page-title">Store scan</h1><p class="page-subtitle">${shop}</p></div>
    </header>
    <div class="card">
      <p class="scan-lead">Run a full analysis of your store. We check products, copy, trust signals, and theme so you get a prioritized list of fixes.</p>
      <p class="scan-what-title">What we analyze</p>
      <ul class="scan-what-list">
        <li>Product titles, descriptions, images, and variants</li>
        <li>Trust signals: guarantees, shipping, returns, contact</li>
        <li>Theme blocks and layout on product and global pages</li>
        <li>Pricing and compare-at consistency</li>
      </ul>
      <p class="scan-steps muted" style="font-size:12px;margin-top:8px;">Recommendations that suggest adding app blocks (e.g. trust, FAQ) require an <strong>Online Store 2.0</strong> theme. <a href="https://help.shopify.com/en/manual/online-store/themes/managing-themes/versions#features" target="_blank" rel="noopener">Theme versions</a></p>
      <p class="scan-steps">Click <strong>Start scan</strong>. The job runs in the background. When it finishes, open <strong>View recommendations</strong> from the app home to see your list.</p>
      <button type="button" id="runBtn" class="btn btn-primary">Start scan</button>
      <div id="result" style="display:none;"></div>
    </div>
    <footer class="footer"><a href="${homeUrl}" target="_top">← Back to app</a></footer>
  </div>
  <script>
    (function() {
      var btn = document.getElementById('runBtn');
      var result = document.getElementById('result');
      var apiUrl = '${apiUrl.replace(/'/g, "\\'")}';
      var recsUrl = '${recsEsc}';
      btn.onclick = function() {
        btn.disabled = true;
        btn.textContent = 'Running…';
        result.style.display = 'none';
        fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            btn.disabled = false;
            btn.textContent = 'Start scan';
            result.style.display = 'block';
            result.className = 'success-card';
            result.innerHTML = '<p class="title">Scan started</p><p class="next">Your store is being analyzed. When the scan finishes, click View recommendations below to see your prioritized list.</p><a href="' + recsUrl + '" target="_top" class="btn btn-primary">View recommendations</a>';
          })
          .catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Start scan';
            result.style.display = 'block';
            result.className = 'result-box';
            result.innerHTML = '<strong>Request failed</strong><br>' + (err.message || 'Try again or go back to the app.');
          });
      };
    })();
  </script>
</body>
</html>`;
  }

  private getRecommendationsPageHtml(shop: string, apiUrl: string, homeUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>${this.getAppBridgeHead()}<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Recommendations — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <header class="page-header page-header-with-logo">
      <a href="${homeUrl}" target="_top" class="logo-link"><img src="/logo.svg" alt="" class="app-logo-small"><span class="app-wordmark-sub">Conversion Optimizer</span></a>
      <div><h1 class="page-title">Recommendations</h1><p class="page-subtitle">${shop}</p></div>
    </header>
    <p class="rec-intro">Prioritized actions to improve conversion. Tackle high-impact items first, then medium and low. Recommendations that add theme blocks require an <a href="https://help.shopify.com/en/manual/online-store/themes/managing-themes/versions#features" target="_blank" rel="noopener">Online Store 2.0</a> theme.</p>
    <div class="card">
      <div id="loading" class="card-text">Loading…</div>
      <div id="content" style="display:none;"></div>
    </div>
    <footer class="footer"><a href="${homeUrl}" target="_top">← Back to app</a></footer>
  </div>
  <script>
    (function() {
      var loading = document.getElementById('loading');
      var content = document.getElementById('content');
      var list = [];
      function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
      function severityClass(s) { return (s || '').toLowerCase().indexOf('high') >= 0 ? 'badge-high' : (s || '').toLowerCase().indexOf('medium') >= 0 ? 'badge-medium' : 'badge-low'; }
      function severityKey(s) { return (s || '').toLowerCase().indexOf('high') >= 0 ? 'high' : (s || '').toLowerCase().indexOf('medium') >= 0 ? 'medium' : 'low'; }
      function renderRecs(filter) {
        var filtered = filter === 'all' ? list : list.filter(function(r) { return severityKey(r.severity) === filter; });
        var high = list.filter(function(r) { return severityKey(r.severity) === 'high'; }).length;
        var med = list.filter(function(r) { return severityKey(r.severity) === 'medium'; }).length;
        var low = list.filter(function(r) { return severityKey(r.severity) === 'low'; }).length;
        var summary = high + ' high, ' + med + ' medium, ' + low + ' low — address high first';
        var impactStr = function(imp) {
          if (!imp || imp.metric !== 'conversion_rate') return '';
          var lo = imp.low != null ? (imp.low * 100).toFixed(1) : '';
          var hi = imp.high != null ? (imp.high * 100).toFixed(1) : '';
          if (lo && hi) return 'Expected impact: +' + lo + '–' + hi + '% conversion rate.';
          return '';
        };
        var cards = '';
        for (var i = 0; i < filtered.length; i++) {
          var r = filtered[i];
          var impact = impactStr(r.expectedImpact);
          cards += '<article class="rec-card" data-severity="' + severityKey(r.severity) + '"><div class="rec-card-head"><span class="rec-title">' + esc(r.title || r.category) + '</span><span class="badge ' + severityClass(r.severity) + '">' + esc(r.severity) + '</span></div><span class="rec-category">' + esc(r.category) + '</span><p class="rec-rationale">' + esc(r.rationale) + '</p>' + (impact ? '<p class="rec-impact">' + esc(impact) + '</p>' : '') + '</article>';
        }
        var ac = function(f) { return 'filter-btn' + (filter === f ? ' active' : ''); };
        var filterBar = '<div class="rec-toolbar"><div class="rec-summary">' + esc(summary) + '</div><div class="rec-filters"><button type="button" class="' + ac('all') + '" data-filter="all">All</button><button type="button" class="' + ac('high') + '" data-filter="high">High</button><button type="button" class="' + ac('medium') + '" data-filter="medium">Medium</button><button type="button" class="' + ac('low') + '" data-filter="low">Low</button></div><button type="button" id="exportBtn" class="btn btn-secondary btn-sm">Export CSV</button></div>';
        content.innerHTML = filterBar + '<div class="rec-list">' + (filtered.length ? cards : '<p class="muted">No recommendations in this group.</p>') + '</div>';
        content.querySelectorAll('.filter-btn').forEach(function(btn) {
          btn.onclick = function() {
            content.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            renderRecs(btn.getAttribute('data-filter'));
          };
        });
        var exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.onclick = function() {
          var csv = 'Title,Category,Severity,Rationale,Expected impact\\n';
          list.forEach(function(r) {
            var imp = r.expectedImpact && r.expectedImpact.metric === 'conversion_rate' && r.expectedImpact.low != null && r.expectedImpact.high != null ? '+' + (r.expectedImpact.low * 100).toFixed(1) + '–' + (r.expectedImpact.high * 100).toFixed(1) + '%' : '';
            csv += '"' + (r.title || r.category || '').replace(/"/g, '""') + '","' + (r.category || '').replace(/"/g, '""') + '","' + (r.severity || '').replace(/"/g, '""') + '","' + (r.rationale || '').replace(/"/g, '""') + '","' + imp + '"\\n';
          });
          var a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'conversion-recommendations.csv'; a.click();
        };
      }
      fetch('${apiUrl.replace(/'/g, "\\'")}')
        .then(function(r) {
          if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
          return r.json();
        })
        .then(function(data) {
          list = data || [];
          loading.style.display = 'none';
          content.style.display = 'block';
          if (list.length === 0) {
            content.innerHTML = '<div class="empty"><p class="empty-title">No recommendations yet</p><p class="empty-text">Run a scan from the app home. We analyze your products, trust signals, and theme and build a prioritized list.</p></div>';
            return;
          }
          renderRecs('all');
        })
        .catch(function(err) {
          loading.style.display = 'none';
          content.style.display = 'block';
          content.innerHTML = '<p class="muted">Could not load recommendations: ' + (err.message || 'Request failed') + '. Try again or go back to the app.</p>';
        });
    })();
  </script>
</body>
</html>`;
  }

  /** Back link: prefer App Store listing so "Back" doesn't send users to the generic API landing page. */
  private getBackUrl(): string {
    const appStore = this.config.get<string>('APP_STORE_LISTING_URL')?.trim();
    if (appStore && appStore !== '#') return appStore;
    return 'https://apps.shopify.com/conversion-optimizer';
  }

  /** "Back to Conversion Optimizer" must go to the store, never to the API. Use return_to, then DEFAULT_BACK_URL, then hardcoded store. */
  private static readonly STORE_BACK_URL = 'https://conversionoptimizer.myshopify.com/';

  private getBackUrlFromRequest(req: Request): string {
    const raw = (req.query?.return_to as string)?.trim();
    if (raw && raw.startsWith('https://')) {
      try {
        const u = new URL(raw);
        if (u.protocol === 'https:' && u.hostname.endsWith('.myshopify.com')) return raw;
      } catch {
        // ignore
      }
    }
    const defaultBack = this.config.get<string>('DEFAULT_BACK_URL')?.trim();
    if (defaultBack && defaultBack.startsWith('https://')) {
      try {
        const u = new URL(defaultBack);
        if (u.protocol === 'https:' && u.hostname.endsWith('.myshopify.com')) return defaultBack.replace(/\/$/, '') + '/';
      } catch {
        // ignore
      }
    }
    return RootController.STORE_BACK_URL;
  }

  private getPolicyHtml(title: string, bodyHtml: string, backUrl?: string): string {
    const url = backUrl ?? this.getBackUrl();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Conversion Optimizer</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif;font-size:16px;line-height:1.65;color:#0f172a;background:#fafbfc;min-height:100vh;padding:40px 24px 64px}
    .wrap{max-width:640px;margin:0 auto}
    .back{margin-bottom:24px}
    .back a{font-size:14px;color:#008060;text-decoration:none;font-weight:500}
    .back a:hover{text-decoration:underline}
    .card{background:#fff;border-radius:14px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,.06);border:1px solid #e5e7eb}
    h1{font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 28px;color:#0f172a}
    h2{font-size:14px;font-weight:600;margin:28px 0 10px;color:#0f172a}
    p{margin:0 0 14px;font-size:15px;color:#334155}
    ul{margin:0 0 14px;padding-left:22px;color:#334155;font-size:15px}
    li{margin-bottom:6px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="back"><a href="${url}">← Back to Conversion Optimizer</a></div>
    <div class="card">
      <h1>${title}</h1>
      ${bodyHtml}
    </div>
  </div>
</body>
</html>`;
  }

  private getPrivacyContent(): string {
    return `
<p><strong>Conversion Optimizer</strong> ("we", "our") is a Shopify app that analyzes your store and provides conversion recommendations. This policy describes what data we collect and how we use it.</p>
<h2>Data we collect</h2>
<ul>
  <li><strong>Shop information:</strong> Your store's myshopify.com domain when you install the app.</li>
  <li><strong>Access token:</strong> A token provided by Shopify after you authorize the app. We store it encrypted and use it only to run store scans and fetch product/theme data via Shopify's API.</li>
  <li><strong>Billing and plan:</strong> Whether you have an active subscription and which plan (Growth or Pro) so we can provide the correct features.</li>
  <li><strong>Recommendations:</strong> The list of recommendations generated by a scan (stored so you can view and export them).</li>
</ul>
<h2>How we use data</h2>
<p>We use the data above only to operate the app: run scans, generate and store recommendations, and manage your subscription. We do not sell or share your data with third parties for marketing. We do not use your data for purposes unrelated to the app.</p>
<h2>Data retention</h2>
<p>We retain your shop record and recommendations while the app is installed. If you uninstall, we mark the shop as uninstalled and stop making API calls. You may request deletion of stored data by contacting support.</p>
<h2>Security</h2>
<p>Access tokens are encrypted at rest. We use HTTPS and follow standard practices to protect data.</p>
<h2>Contact</h2>
<p>For privacy-related questions, use the support contact provided in the app listing.</p>`;
  }

  private getRefundContent(): string {
    return `
<p><strong>Conversion Optimizer</strong> subscriptions are billed monthly through Shopify. This policy explains cancellation and refunds.</p>
<h2>Cancellation</h2>
<p>You may cancel your subscription at any time from your Shopify Admin: Settings → Billing → find Conversion Optimizer and cancel. No further charges will be made after cancellation. You keep access until the end of the current billing period.</p>
<h2>Refunds</h2>
<p>We do not offer prorated refunds for partial months. If you cancel, you retain access until the period you paid for ends. If you believe you were charged in error (e.g. duplicate charge), contact us and we will work with you to resolve it.</p>
<h2>Contact</h2>
<p>For billing or refund questions, use the support contact provided in the app listing.</p>`;
  }

  private getSupportPageHtml(backUrl?: string): string {
    const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    const url = backUrl ?? this.getBackUrl();
    const supportEmail = this.config.get<string>('SUPPORT_EMAIL')?.trim() || '';
    const contactBlock = supportEmail
      ? `<p><strong>Email:</strong> <a href="mailto:${this.escapeHtml(supportEmail)}">${this.escapeHtml(supportEmail)}</a></p><p>We aim to respond to all inquiries quickly. <strong>Pro plan</strong> subscribers get 24/7 priority support.</p>`
      : '<p>Contact support through the email or link provided in the app listing (Shopify App Store or inside the app). <strong>Pro plan</strong> subscribers get 24/7 priority support.</p>';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Support — Conversion Optimizer</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif;font-size:16px;line-height:1.65;color:#0f172a;background:#fafbfc;min-height:100vh;padding:40px 24px 64px}
    .wrap{max-width:640px;margin:0 auto}
    .back{margin-bottom:24px}
    .back a{font-size:14px;color:#008060;text-decoration:none;font-weight:500}
    .back a:hover{text-decoration:underline}
    .card{background:#fff;border-radius:14px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,.06);border:1px solid #e5e7eb}
    h1{font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 28px;color:#0f172a}
    h2{font-size:14px;font-weight:600;margin:28px 0 10px;color:#0f172a}
    p{margin:0 0 14px;font-size:15px;color:#334155}
    .pro-badge{display:inline-block;background:#f0fdf9;color:#008060;border:1px solid #ccfbf1;padding:8px 14px;border-radius:10px;font-size:14px;font-weight:600;margin:12px 0}
    a{color:#008060;text-decoration:none;font-weight:500}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="back"><a href="${url}">← Back to Conversion Optimizer</a></div>
    <div class="card">
      <h1>Support</h1>
      <p>Have questions, issues, or feedback? We're here to help.</p>
      <div class="pro-badge">Pro plan: 24/7 priority support</div>
      <h2>Contact us</h2>
      ${contactBlock}
      <h2>Common topics</h2>
      <p><strong>Billing or plan:</strong> Cancel or change your plan from Shopify Admin → Settings → Billing. For refunds, see our <a href="${baseUrl}/refund">Refund policy</a>.</p>
      <p><strong>Privacy or data:</strong> See our <a href="${baseUrl}/privacy">Privacy policy</a>.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /** Premium landing page for the app — shown at GET / (no shop) and GET /landing. */
  private getLandingPageHtml(baseUrl: string, appStoreUrl: string): string {
    const ctaUrl = appStoreUrl && appStoreUrl !== '#' ? appStoreUrl : 'https://apps.shopify.com/';
    const privacyUrl = `${baseUrl}/privacy`;
    const refundUrl = `${baseUrl}/refund`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Conversion Optimizer analyzes your Shopify store and shows you what's wrong. Get a clear list of fixes so your store converts better and starts selling. Try the app.">
  <link rel="icon" href="${baseUrl}/favicon.svg" type="image/svg+xml">
  <title>Conversion Optimizer — The app that helps your store sell more</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;background:#fff}
    .wrap{max-width:720px;margin:0 auto;padding:48px 24px 64px}
    .hero{padding:56px 0 48px;text-align:center;border-bottom:1px solid #e8e8e8}
    .hero h1{font-size:clamp(28px,5vw,38px);font-weight:700;letter-spacing:-0.03em;margin:0 0 16px;color:#0d0d0d}
    .hero .tagline{font-size:18px;color:#4a4a4a;margin:0 0 32px;max-width:520px;margin-left:auto;margin-right:auto}
    .btn{display:inline-block;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer;border:none;transition:background .2s,transform .05s}
    .btn-primary{background:#00664f;color:#fff}
    .btn-primary:hover{background:#004d3d}
    .btn-secondary{background:#f5f5f5;color:#1a1a1a;border:1px solid #e0e0e0}
    .btn-secondary:hover{background:#ebebeb}
    .section{margin:48px 0}
    .section h2{font-size:22px;font-weight:600;letter-spacing:-0.02em;margin:0 0 20px;color:#0d0d0d}
    .section p{color:#4a4a4a;margin:0 0 16px}
    .section ul{margin:0 0 16px;padding-left:24px;color:#4a4a4a}
    .section li{margin-bottom:8px}
    .pricing{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;margin:24px 0}
    .plan{background:#fafafa;border:1px solid #e8e8e8;border-radius:12px;padding:24px;text-align:center}
    .plan-name{font-weight:600;font-size:15px;margin-bottom:4px;color:#0d0d0d}
    .plan-price{font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#00664f}
    .plan-period{font-size:13px;color:#6b6b6b}
    .plan-desc{font-size:13px;color:#6b6b6b;margin-top:12px;line-height:1.45}
    .cta-box{text-align:center;padding:40px 24px;background:#f9faf9;border-radius:12px;margin:48px 0}
    .cta-box .btn{margin-top:8px}
    .footer{margin-top:56px;padding-top:24px;border-top:1px solid #e8e8e8;font-size:14px;color:#6b6b6b;text-align:center}
    .footer a{color:#00664f;text-decoration:none;font-weight:500}
    .footer a:hover{text-decoration:underline}
    .footer span{margin:0 8px;color:#ccc}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>Conversion Optimizer</h1>
      <p class="tagline">The app that analyzes your Shopify store and shows you exactly what's wrong. Get a clear list of fixes so your store converts better and starts selling.</p>
      <a href="${ctaUrl}" target="_blank" rel="noopener" class="btn btn-primary">Get the app</a>
    </header>

    <section class="section">
      <h2>What it does</h2>
      <p>We scan your store and tell you what's broken: product pages, trust signals, theme, and pricing. You get a prioritized list of recommendations—no guesswork. Fix the problems, get more traffic, and start selling.</p>
      <ul>
        <li><strong>Store scan</strong> — One-click analysis of your products, theme, and trust signals.</li>
        <li><strong>Prioritized list</strong> — High, medium, and low severity so you fix what matters first.</li>
        <li><strong>Actionable fixes</strong> — Each item explains what to change and why.</li>
        <li><strong>Filter & export</strong> — Filter by severity; export to CSV for your team.</li>
      </ul>
    </section>

    <section class="section">
      <h2>Plans</h2>
      <p>Cancel anytime from your Shopify billing. All plans include store scan, recommendations, and CSV export.</p>
      <div class="pricing">
        <div class="plan"><div class="plan-name">Growth</div><div class="plan-price">$19</div><span class="plan-period">/mo</span><p class="plan-desc">Full access: store scan, recommendations, filter by severity, export CSV. Best for growing stores.</p></div>
        <div class="plan" style="border-color:#008060;background:#f9fafb"><div class="plan-name">Pro</div><div class="plan-price">$29</div><span class="plan-period">/mo</span><p class="plan-desc">Premium with 24/7 support. Everything in Growth, plus priority help and dedicated support for teams and high-volume stores.</p></div>
      </div>
    </section>

    <div class="cta-box">
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0d0d0d">Ready to fix your store?</p>
      <p style="margin:0;color:#4a4a4a">Install Conversion Optimizer from the Shopify App Store and run your first scan.</p>
      <a href="${ctaUrl}" target="_blank" rel="noopener" class="btn btn-primary">Get the app</a>
    </div>

    <footer class="footer">
      <a href="${privacyUrl}">Privacy</a><span>|</span><a href="${refundUrl}">Refund policy</a>
    </footer>
  </div>
</body>
</html>`;
  }

  private getBaseUrl(req: Request): string {
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    return `${proto}://${host}`;
  }

  private normalizeShop(shop: string): string {
    const s = shop.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    return s.includes('.myshopify.com') ? s : `${s}.myshopify.com`;
  }
}
