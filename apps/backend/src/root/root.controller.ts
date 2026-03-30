import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as path from 'path';
import { ShopsService } from '../shops/shops.service';
import { BillingService } from '../billing/billing.service';

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
    private readonly billing: BillingService,
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

  /** GET /billing/confirm?shop=...&plan=starter|growth|pro|pro_annual. */
  @Get('billing/confirm')
  billingConfirm(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();
    const requestedPlan = (req.query.plan as string)?.toLowerCase().trim();
    const plan = requestedPlan === 'starter' || requestedPlan === 'pro' || requestedPlan === 'pro_annual' ? requestedPlan : 'growth';
    if (!shop || !plan) {
      res.status(400).send('Missing shop or plan');
      return;
    }
    const baseUrl = this.getBaseUrl(req);
    const normalized = this.normalizeShop(shop);
    const shopEnc = encodeURIComponent(normalized);
    const homeUrl = `${baseUrl}/?shop=${shopEnc}`;
    const selectedPlan = plan;
    const isSameCurrentPlan = async (): Promise<boolean> => {
      const existing = await this.shops.findByDomain(normalized);
      if (!existing || !this.shops.hasPaidPlan(existing)) return false;
      const current = existing.plan === 'paid' ? 'growth' : existing.plan;
      return current === selectedPlan;
    };
    isSameCurrentPlan()
      .then((same) => {
        if (same) {
          res.redirect(302, `${homeUrl}&same_plan=1`);
          return;
        }
        const subscribeUrl = `${baseUrl}/api/billing/subscribe?shop=${shopEnc}&plan=${encodeURIComponent(plan)}`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.send(this.getBillingConfirmHtml(plan, baseUrl, homeUrl, subscribeUrl));
      })
      .catch(() => {
        const subscribeUrl = `${baseUrl}/api/billing/subscribe?shop=${shopEnc}&plan=${encodeURIComponent(plan)}`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.send(this.getBillingConfirmHtml(plan, baseUrl, homeUrl, subscribeUrl));
      });
    return;
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

    let hasPlan = this.shops.hasPaidPlan(existing);
    let currentPlanLabel = this.shops.getPlanLabel(existing);
    let currentPlanKey =
      existing.plan === 'pro_annual' ? 'pro_annual' : existing.plan === 'pro' ? 'pro' : existing.plan === 'starter' ? 'starter' : 'growth';
    let activeUntilIso = (req.query.active_until as string)?.trim() || '';
    try {
      const activeInfo = await this.billing.getActiveSubscriptionInfo(normalized);
      if (activeInfo) {
        hasPlan = true;
        currentPlanLabel = activeInfo.planLabel;
        currentPlanKey = activeInfo.planKey;
        activeUntilIso = activeInfo.currentPeriodEnd ?? '';
        // Keep local billing state in sync after reinstall with persisting active Shopify plan.
        await this.shops.setPaidPlan(normalized, String(this.extractTailId(activeInfo.id)), activeInfo.planKey);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Root] Active billing sync skipped:', err instanceof Error ? err.message : String(err));
      }
    }
    const isFreeBeta = this.shops.isFreeBetaShop(normalized);
    const billingError = String(req.query.billing_error) === '1';
    const billingSuccess = String(req.query.billing_success) === '1';
    const planJustPurchased = (req.query.plan as string)?.trim() || '';
    const cancelled = String(req.query.cancelled) === '1';
    const billingCancelError = String(req.query.billing_cancel_error) === '1';
    const samePlan = String(req.query.same_plan) === '1';
    const cancelledPlanLabel = (req.query.cancelled_plan as string)?.trim() || '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const appStoreListingUrl = this.config.get<string>('APP_STORE_LISTING_URL');
    res.send(this.getAppHomeHtml(normalized, hasPlan, currentPlanLabel, currentPlanKey, baseUrl, billingError, appStoreListingUrl, billingSuccess, planJustPurchased, cancelled, billingCancelError, isFreeBeta, samePlan, activeUntilIso, cancelledPlanLabel));
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

  /** Dismiss Shopify Admin loading overlay so the app content is visible. Prevents false "crash" / "taking a while to load" overlay. */
  private getDismissAppBridgeLoadingScript(): string {
    return `<script>(function(){function d(){try{if(typeof shopify!="undefined"&&shopify.loading)shopify.loading(false);}catch(e){}}if(document.readyState==="complete"){d();setTimeout(d,150);}else{window.addEventListener("load",function(){d();setTimeout(d,150);});}})();</script>`;
  }

  private getAppHomeHtml(shop: string, hasPlan: boolean, currentPlanLabel: string, currentPlanKey: string, baseUrl: string, billingError = false, appStoreListingUrl?: string, billingSuccess = false, planJustPurchased = '', cancelled = false, billingCancelError = false, isFreeBeta = false, samePlan = false, activeUntilIso = '', cancelledPlanLabel = ''): string {
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
      { key: 'pro_annual', name: 'Pro Annual', price: 290, period: '/year', desc: 'Annual Pro billing for teams. Same Pro features with a lower effective monthly cost.' },
    ];

    const billingSuccessBanner = billingSuccess
      ? this.getThankYouBanner(planJustPurchased)
      : '';
    const cancelledBanner = cancelled
      ? '<div class="banner banner-success"><p class="banner-title">Subscription cancelled</p><p class="banner-body">You\'ll keep full access until the end of your current billing period.</p></div>'
      : '';
    const billingCancelErrorBanner = billingCancelError
      ? '<div class="banner banner-error"><p class="banner-title">Cancellation failed</p><p class="banner-body">We couldn\'t cancel your subscription. Please try again or contact support.</p></div>'
      : '';
    const billingBanner = billingError
      ? (hasPlan
          ? `<div class="banner banner-error"><p class="banner-title">Plan change failed</p><p class="banner-body">We couldn't complete your plan change. Your current <strong>${this.escapeHtml(currentPlanLabel)}</strong> plan is still active. Please try again or contact support.</p></div>`
          : '<div class="banner banner-error"><p class="banner-title">Subscription failed</p><p class="banner-body">Subscription could not be started. Please try again or contact support.</p></div>')
      : '';
    const samePlanBanner = samePlan
      ? `<div class="banner banner-info"><p class="banner-title">Already on this plan</p><p class="banner-body">You are already subscribed to <strong>${this.escapeHtml(currentPlanLabel)}</strong>. Select a different plan to switch.</p></div>`
      : '';
    const hasRemainingPaidAccess = Boolean(activeUntilIso);
    const hasAccess = hasPlan || hasRemainingPaidAccess;
    const periodPlanLabel = cancelledPlanLabel || currentPlanLabel;
    const activeUntilBanner = activeUntilIso
      ? `<div class="banner banner-neutral"><p class="banner-title">Current billing period</p><p class="banner-body">Your <strong>${this.escapeHtml(periodPlanLabel)}</strong> plan remains active until <strong>${this.escapeHtml(this.formatDate(activeUntilIso))}</strong>. You can change plans anytime from this page without contacting support.</p></div>`
      : '';
    const billingCard = hasAccess
      ? isFreeBeta
        ? `<div class="card"><p class="card-title">Billing</p><p class="card-text">Your plan: <strong>${this.escapeHtml(currentPlanLabel)}</strong>. Full access for testers — no payment required.</p></div>`
        : `<div class="card"><p class="card-title">Billing</p><p class="card-text">Your plan: <strong>${this.escapeHtml(periodPlanLabel)}</strong>. You have full access to all scans and recommendations.</p><p class="card-text">${cancelled ? 'This subscription is cancelled and will remain active until period end.' : "Cancel anytime — you'll keep access until the end of your billing period."}</p><div class="billing-actions"><a href="${subscribeBase}" target="_top" class="btn btn-outline">Manage billing</a>${cancelled ? '' : `<a href="${this.escapeHtml(cancelConfirmUrl)}" target="_top" class="btn btn-outline">Cancel subscription</a>`}</div></div>`
      : '';
    const plansCard = `<div class="card"><p class="card-title">Plans</p><p class="card-text">${hasPlan ? 'Change plan or manage billing below. ' : ''}Cancel anytime from the app or your Shopify billing.</p><div class="plans-grid">${plansDisplay.map((p) => {
      const isCurrent = hasPlan && p.key === currentPlanKey;
      return `<div class="plan-card${p.popular ? ' plan-popular' : ''}${isCurrent ? ' plan-card-current' : ''}"><div class="plan-head"><p class="plan-name">${p.name}</p>${isCurrent ? '<span class="plan-current-badge">Current</span>' : p.popular ? '<span class="plan-popular-badge">Popular</span>' : '<span></span>'}</div><div class="plan-price">$${p.price}<span class="plan-period">${p.period ?? '/mo'}</span></div><p class="plan-desc">${p.desc}</p><div class="plan-btn-wrap">${isCurrent ? '<span class="btn-plan btn-plan-disabled">Current plan</span>' : `<a href="${confirmBase}&plan=${p.key}" target="_top" class="btn-plan">${hasPlan ? 'Switch plan' : 'Select plan'}</a>`}</div></div>`;
    }).join('')}</div><p class="pricing-disclosure">Pricing details: Growth $19 monthly, Pro $29 monthly, Pro Annual $290 yearly. No free trial at this time.</p></div>`;
    const ctaCard = billingCard + plansCard;

    const actionsCard = hasAccess
      ? `<div class="card"><p class="card-title">Actions</p><div class="action-list"><div class="action-item"><a href="${scanRunUrl}" target="_top" class="btn btn-primary"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3l7 4-7 4V3z" fill="currentColor"/></svg>Run scan</a><span class="action-desc">Analyze your store and generate a prioritized CRO list</span></div><div class="action-item"><a href="${recsPageUrl}" target="_top" class="btn btn-outline">View recommendations</a><span class="action-desc">Browse and export your prioritized recommendations</span></div></div></div>`
      : '<div class="card"><p class="card-text muted" style="font-size:13px;">Run scan and View recommendations unlock after subscribing to a plan below.</p></div>';

    const checkIcon = `<span class="feat-icon"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="#15803d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    const featuresHtml = `
    <div class="features-card">
      <p class="section-label">What you get</p>
      <p class="section-desc">One scan gives you a clear, prioritized list of fixes so your store converts better and sells more.</p>
      <ul class="feature-list">
        <li>${checkIcon}<span><strong>Store scan</strong> — Products, titles, images, trust signals, pricing, and theme — nothing is missed.</span></li>
        <li>${checkIcon}<span><strong>Prioritized list</strong> — Every fix is tagged high, medium, or low severity so you tackle what matters first.</span></li>
        <li>${checkIcon}<span><strong>Actionable rationales</strong> — Each item explains exactly what to change and why it lifts conversion.</span></li>
        <li>${checkIcon}<span><strong>Filter &amp; export</strong> — Filter by severity and export to CSV to share with your team.</span></li>
        <li>${checkIcon}<span><strong>Ongoing value</strong> — Re-run anytime after making improvements to track progress.</span></li>
      </ul>
    </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/logo.svg" as="image">
  <title>${title}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:28px 20px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#202223;background:#f6f6f7;min-height:100vh}
    .home-wrap{max-width:760px;margin:0 auto}
    .app-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid #e1e3e5}
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none}
    .app-logo-icon{height:28px;width:28px;display:block;flex-shrink:0}
    .app-wordmark{font-size:16px;font-weight:700;color:#202223;letter-spacing:-0.02em}
    .shop-badge{font-size:12px;color:#8c9196;font-weight:500;background:#f1f2f3;padding:4px 10px;border-radius:20px}
    .banner{border-radius:10px;padding:16px 18px;margin-bottom:16px;font-size:14px}
    .banner-success{background:#f0fdf4;border:1px solid #86efac;color:#166534}
    .banner-error{background:#fff0ed;border:1px solid #fca69d;color:#7a1a0e}
    .banner-info{background:#eef6ff;border:1px solid #b8d8ff;color:#1e4f8f}
    .banner-neutral{background:#f5f7fa;border:1px solid #d8dee7;color:#334155}
    .banner-title{font-weight:700;margin:0 0 4px}
    .banner-body{margin:0;line-height:1.5}
    .hero-block{margin:0 0 20px;padding:18px 20px;background:#fff;border-radius:10px;border:1px solid #e1e3e5;border-left:4px solid #008060}
    .hero-text{font-size:14px;color:#44474a;line-height:1.65;margin:0}
    .hero-text strong{color:#202223}
    .features-card{background:#fff;border:1px solid #e1e3e5;border-radius:10px;padding:20px 22px;margin-bottom:16px}
    .section-label{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8c9196;margin:0 0 14px}
    .section-desc{font-size:13px;color:#6d7175;margin:0 0 14px;line-height:1.55}
    .feature-list{margin:0;padding:0;list-style:none}
    .feature-list li{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #f2f2f2;font-size:13px;color:#44474a;line-height:1.5}
    .feature-list li:last-child{border-bottom:none;padding-bottom:0}
    .feat-icon{width:20px;height:20px;border-radius:6px;background:#f0fdf4;border:1px solid #bbf7d0;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .card{background:#fff;border:1px solid #e1e3e5;border-radius:10px;padding:20px 22px;margin-bottom:16px}
    .hero-block,.features-card,.card{content-visibility:auto;contain-intrinsic-size:1px 260px}
    .card-error{border-color:#d72c0d;background:#fff5f4}
    .card-success{border-color:#86efac;background:linear-gradient(135deg,#f0fdf4 0%,#fff 60%)}
    .card-success-icon{width:36px;height:36px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;margin-bottom:10px}
    .card-title{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8c9196;margin:0 0 14px}
    .card-title-success{color:#166534}
    .card-text{font-size:14px;color:#6d7175;margin:0 0 12px;line-height:1.55}
    .card-text:last-child,.card-text.muted{margin-bottom:0}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;border:none;cursor:pointer;font-family:inherit;transition:background .12s,border-color .12s;line-height:1;white-space:nowrap}
    .btn-primary{background:#008060;color:#fff;box-shadow:0 1px 2px rgba(0,128,96,.2)}
    .btn-primary:hover{background:#006e52}
    .btn-outline{background:#fff;color:#202223;border:1px solid #c9cccf}
    .btn-outline:hover{background:#f6f6f7;border-color:#999ea4}
    .plans-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:6px;align-items:stretch}
    .plan-card{position:relative;display:flex;flex-direction:column;min-height:280px;background:#fafbfc;border:1px solid #dfe3e8;border-radius:10px;padding:16px 16px 14px}
    .plan-card.plan-popular{background:#f9fefb;border-color:#dfe3e8;box-shadow:0 2px 8px rgba(15,23,42,.06)}
    .plan-card.plan-card-current{border-color:#0f766e;box-shadow:0 0 0 1px #0f766e inset}
    .plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px}
    .plan-popular-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#008060;background:#e6f7f2;padding:2px 7px;border-radius:20px}
    .plan-current-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#0f766e;background:#e6fffb;padding:2px 7px;border-radius:20px}
    .plan-name{font-size:14px;font-weight:700;color:#202223;margin:0}
    .plan-price{font-size:34px;font-weight:800;color:#008060;letter-spacing:-0.03em;line-height:1.05;margin-top:10px}
    .plan-period{font-size:12px;font-weight:500;color:#8c9196}
    .plan-desc{font-size:12px;color:#6d7175;line-height:1.45;margin:10px 0 0;min-height:88px;flex:1}
    .plan-btn-wrap{margin-top:14px}
    .btn-plan{width:100%;height:42px;background:#008060;color:#fff;padding:0 14px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;display:flex;align-items:center;justify-content:center;text-align:center;transition:background .12s}
    .btn-plan:hover{background:#006e52}
    .btn-plan-disabled{background:#eef2f6;color:#7a8796;cursor:not-allowed}
    .pricing-disclosure{margin-top:12px;padding:10px 12px;border:1px dashed #c9cccf;border-radius:8px;background:#fcfcfd;font-size:12px;color:#6d7175;line-height:1.5}
    .action-list{display:flex;flex-direction:column;gap:10px}
    .action-item{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 0;border-bottom:1px solid #f2f2f2}
    .action-item:last-child{border-bottom:none;padding-bottom:0}
    .action-desc{font-size:13px;color:#6d7175;flex:1;min-width:160px}
    .billing-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
    .app-footer{margin-top:28px;padding-top:16px;border-top:1px solid #e1e3e5;font-size:12px;color:#8c9196;display:flex;flex-wrap:wrap;gap:14px}
    .app-footer a{color:#008060;text-decoration:none;font-weight:500}
    .app-footer a:hover{text-decoration:underline}
    @media(max-width:768px){.plans-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="home-wrap">
    <header class="app-header">
      <div class="brand"><img src="/logo.svg" alt="" class="app-logo-icon"><span class="app-wordmark">${title}</span></div>
      <span class="shop-badge">${shopSafe}</span>
    </header>
    ${billingSuccessBanner}
    ${cancelledBanner}
    ${billingCancelErrorBanner}
    ${billingBanner}
    ${samePlanBanner}
    ${activeUntilBanner}
    <div class="hero-block">
      <p class="hero-text"><strong>Conversion Optimizer</strong> gives you a prioritized list of changes to improve your store's conversion rate. Run a scan, then work through recommendations by severity.</p>
    </div>
    ${featuresHtml}
    ${ctaCard}
    ${actionsCard}
    <footer class="app-footer">
      <a href="${statusUrl}" target="_top">Billing status</a>${appStoreListingUrl ? ` <a href="${this.escapeHtml(appStoreListingUrl)}" target="_blank" rel="noopener">Leave a review ↗</a>` : ''}
    </footer>
  </div>
  ${this.getDismissAppBridgeLoadingScript()}
</body>
</html>`;
  }

  private extractTailId(gid: string): string {
    const m = String(gid).match(/(\d+)$/);
    return m ? m[1] : String(gid);
  }

  private formatDate(isoLike: string): string {
    const d = new Date(isoLike);
    if (Number.isNaN(d.getTime())) return isoLike;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private getThankYouBanner(planKey: string): string {
    const planName = planKey === 'pro_annual' ? 'Pro Annual' : planKey === 'pro' ? 'Pro' : planKey === 'starter' ? 'Starter' : 'Growth';
    return `<div class="banner banner-success"><p class="banner-title">🎉 Welcome to ${this.escapeHtml(planName)}!</p><p class="banner-body">Your plan is now active. You have full access to store scans and recommendations. Run your first scan to get started.</p></div>`;
  }

  private getBillingConfirmHtml(planKey: string, baseUrl: string, homeUrl: string, subscribeUrl: string): string {
    const planName = planKey === 'pro_annual' ? 'Pro Annual' : planKey === 'pro' ? 'Pro' : planKey === 'starter' ? 'Starter' : 'Growth';
    const price = planKey === 'pro_annual' ? 290 : planKey === 'pro' ? 29 : planKey === 'starter' ? 9 : 19;
    const period = planKey === 'pro_annual' ? '/year' : '/month';
    const isPopular = planKey === 'pro' || planKey === 'pro_annual';
    const planDescription = planKey === 'pro_annual'
      ? 'Everything in Pro, billed yearly with a lower effective monthly cost. Ideal for long-term teams.'
      : planKey === 'pro'
        ? 'Everything in Growth, plus 24/7 priority support. Perfect for teams and high-volume stores.'
        : 'Full access to store scan, recommendations, filter by severity, and CSV export.';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>Confirm — ${this.escapeHtml(planName)} plan</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:32px 20px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#202223;background:#f6f6f7;min-height:100vh}
    .wrap{max-width:480px;margin:0 auto}
    .top-nav{display:flex;align-items:center;gap:8px;margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid #e1e3e5}
    .top-logo{height:26px;width:26px;flex-shrink:0}
    .top-wordmark{font-size:15px;font-weight:700;color:#202223;letter-spacing:-0.02em}
    .card{background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:26px 28px;margin-bottom:16px}
    .plan-badge{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${isPopular ? '#008060' : '#6d7175'};background:${isPopular ? '#e6f7f2' : '#f6f6f7'};border:1px solid ${isPopular ? '#a7f3d0' : '#e1e3e5'};padding:3px 10px;border-radius:20px;margin-bottom:14px}
    .plan-name{font-size:22px;font-weight:800;color:#202223;letter-spacing:-0.02em;margin:0 0 4px}
    .plan-price{font-size:32px;font-weight:800;color:#008060;letter-spacing:-0.03em;line-height:1;margin:0 0 4px}
    .plan-period{font-size:14px;font-weight:400;color:#8c9196}
    .plan-note{font-size:13px;color:#6d7175;background:#f9fafb;border:1px solid #e1e3e5;border-radius:8px;padding:12px 14px;margin:18px 0 22px;line-height:1.55}
    .plan-desc{font-size:14px;color:#44474a;line-height:1.6;margin:12px 0 22px}
    .divider{border:none;border-top:1px solid #e1e3e5;margin:20px 0}
    .btn-wrap{display:flex;flex-direction:column;gap:10px}
    .btn{display:block;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;border:none;cursor:pointer;font-family:inherit;text-align:center;transition:background .12s}
    .btn-primary{background:#008060;color:#fff}
    .btn-primary:hover{background:#006e52}
    .btn-ghost{background:transparent;color:#6d7175;font-size:13px;padding:10px}
    .btn-ghost:hover{color:#202223}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top-nav">
      <img src="/logo.svg" alt="" class="top-logo">
      <span class="top-wordmark">Conversion Optimizer</span>
    </div>
    <div class="card">
      <div class="plan-badge">${isPopular ? 'Most popular' : 'Plan'}</div>
      <p class="plan-name">${this.escapeHtml(planName)}</p>
      <p class="plan-price">$${price}<span class="plan-period">${period}</span></p>
      <p class="plan-desc">${planDescription}</p>
      <hr class="divider">
      <p class="plan-note">You'll be redirected to Shopify to complete payment securely. Your subscription will appear on your next Shopify bill. Cancel anytime from the app or Shopify Admin → Settings → Billing. No free trial is currently offered.</p>
      <div class="btn-wrap">
        <a href="${subscribeUrl}" target="_top" class="btn btn-primary">Continue to Shopify checkout →</a>
        <a href="${homeUrl}" target="_top" class="btn btn-ghost">← Back to plans</a>
      </div>
    </div>
  </div>
  ${this.getDismissAppBridgeLoadingScript()}
</body>
</html>`;
  }

  private getBillingCancelConfirmHtml(baseUrl: string, homeUrl: string, cancelUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>Cancel subscription — Conversion Optimizer</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:32px 20px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#202223;background:#f6f6f7;min-height:100vh}
    .wrap{max-width:480px;margin:0 auto}
    .top-nav{display:flex;align-items:center;gap:8px;margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid #e1e3e5}
    .top-logo{height:26px;width:26px;flex-shrink:0}
    .top-wordmark{font-size:15px;font-weight:700;color:#202223;letter-spacing:-0.02em}
    .card{background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:26px 28px;margin-bottom:16px}
    .cancel-icon{width:44px;height:44px;border-radius:50%;background:#fff5f4;border:2px solid #fca69d;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
    .cancel-title{font-size:20px;font-weight:700;color:#202223;margin:0 0 8px;letter-spacing:-0.02em}
    .cancel-desc{font-size:14px;color:#44474a;line-height:1.65;margin:0 0 8px}
    .cancel-note{font-size:13px;color:#8c9196;margin:0 0 24px;line-height:1.5}
    .divider{border:none;border-top:1px solid #e1e3e5;margin:20px 0}
    .btn-wrap{display:flex;flex-direction:column;gap:10px}
    .btn{display:block;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;border:none;cursor:pointer;font-family:inherit;text-align:center;transition:background .12s}
    .btn-danger{background:#d72c0d;color:#fff}
    .btn-danger:hover{background:#b71c0d}
    .btn-primary{background:#008060;color:#fff}
    .btn-primary:hover{background:#006e52}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top-nav">
      <img src="/logo.svg" alt="" class="top-logo">
      <span class="top-wordmark">Conversion Optimizer</span>
    </div>
    <div class="card">
      <div class="cancel-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 10V6m0 6v.5" stroke="#d72c0d" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="10" r="8" stroke="#d72c0d" stroke-width="1.5"/></svg>
      </div>
      <h1 class="cancel-title">Cancel your subscription?</h1>
      <p class="cancel-desc">You'll keep full access until the end of your current billing period. After that, you won't be charged.</p>
      <p class="cancel-note">You can resubscribe anytime from the app home.</p>
      <hr class="divider">
      <div class="btn-wrap">
        <a href="${homeUrl}" target="_top" class="btn btn-primary">Keep my subscription</a>
        <a href="${cancelUrl}" target="_top" class="btn btn-danger">Yes, cancel my subscription</a>
      </div>
    </div>
  </div>
  ${this.getDismissAppBridgeLoadingScript()}
</body>
</html>`;
  }

  private getBaseStyles(): string {
    return `*{box-sizing:border-box}body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#202223;background:#f6f6f7;min-height:100vh}
    .page-wrap{max-width:720px;margin:0 auto;padding:28px 24px 48px}
    /* Sub-page header: back link top, then title full-width aligned with content */
    .page-nav{display:flex;align-items:center;margin-bottom:20px}
    .page-nav-back{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#6d7175;text-decoration:none;padding:6px 0;transition:color .15s}
    .page-nav-back:hover{color:#202223}
    .page-nav-back svg{flex-shrink:0}
    .page-heading{margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e1e3e5}
    .page-heading h1{font-size:22px;font-weight:700;letter-spacing:-0.025em;color:#202223;margin:0 0 4px 0;line-height:1.2}
    .page-heading .page-shop{font-size:13px;color:#8c9196;margin:0;font-weight:400}
    /* Cards */
    .card{background:#fff;border-radius:10px;border:1px solid #e1e3e5;padding:22px;margin-bottom:16px}
    .card+.card{margin-top:0}
    .card-title{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#6d7175;margin:0 0 14px 0}
    .card-text{font-size:14px;color:#6d7175;margin:0 0 14px 0;line-height:1.55}
    .card-text:last-child{margin-bottom:0}
    /* Buttons */
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;border:none;cursor:pointer;font-family:inherit;transition:background .12s,border-color .12s,box-shadow .12s;line-height:1;white-space:nowrap}
    .btn-primary{background:#008060;color:#fff;box-shadow:0 1px 2px rgba(0,128,96,.25)}
    .btn-primary:hover{background:#006e52;box-shadow:0 2px 6px rgba(0,128,96,.3)}
    .btn-secondary{background:#fff;color:#202223;border:1px solid #c9cccf}
    .btn-secondary:hover{background:#f6f6f7;border-color:#999ea4}
    .btn:disabled{opacity:.55;cursor:not-allowed;pointer-events:none}
    .btn-sm{padding:7px 14px;font-size:13px}
    .btn-lg{padding:13px 24px;font-size:15px}
    /* Scan page */
    .scan-intro{font-size:14px;color:#44474a;line-height:1.6;margin:0 0 20px}
    .scan-checklist{list-style:none;padding:0;margin:0 0 24px}
    .scan-checklist li{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f1f1f1;font-size:13px;color:#44474a;line-height:1.5}
    .scan-checklist li:last-child{border-bottom:none}
    .scan-check{width:18px;height:18px;border-radius:50%;background:#f0fdf4;border:1.5px solid #86efac;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center}
    .scan-check svg{display:block}
    .scan-note{font-size:12px;color:#8c9196;margin:0 0 20px;line-height:1.5}
    .scan-note a{color:#008060;text-decoration:none;font-weight:500}
    .scan-note a:hover{text-decoration:underline}
    .scan-result{margin-top:20px;border-radius:10px;padding:20px;display:none}
    .scan-result.success{background:#f0fdf4;border:1px solid #86efac}
    .scan-result.error{background:#fff0ed;border:1px solid #fca69d}
    .scan-result .sr-title{font-size:14px;font-weight:700;margin:0 0 6px;color:#166534}
    .scan-result.error .sr-title{color:#c0392b}
    .scan-result .sr-body{font-size:13px;color:#374151;margin:0 0 14px;line-height:1.55}
    .scan-result.error .sr-body{color:#6b2c2c}
    /* Recommendations */
    .rec-intro{font-size:14px;color:#44474a;line-height:1.6;margin:0 0 20px}
    .rec-intro a{color:#008060;text-decoration:none;font-weight:500}
    .rec-intro a:hover{text-decoration:underline}
    .rec-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e1e3e5}
    .rec-summary{font-size:13px;color:#6d7175;flex:1;min-width:160px}
    .rec-summary strong{color:#202223;font-weight:600}
    .rec-filters{display:flex;gap:4px;flex-wrap:wrap}
    .filter-btn{padding:6px 12px;border:1.5px solid #e1e3e5;background:#fff;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;color:#6d7175;font-family:inherit;transition:all .12s;line-height:1}
    .filter-btn:hover{border-color:#c9cccf;color:#202223;background:#f9f9f9}
    .filter-btn.active{background:#202223;color:#fff;border-color:#202223}
    .filter-btn.active-high{background:#b91c1c;color:#fff;border-color:#b91c1c}
    .filter-btn.active-medium{background:#b45309;color:#fff;border-color:#b45309}
    .filter-btn.active-low{background:#15803d;color:#fff;border-color:#15803d}
    .rec-list{display:flex;flex-direction:column;gap:12px}
    .rec-card{background:#fff;border:1px solid #e1e3e5;border-radius:10px;padding:18px 20px;transition:box-shadow .15s}
    .rec-card:hover{box-shadow:0 2px 10px rgba(0,0,0,.06)}
    .rec-card[data-severity="high"]{border-left:3px solid #d72c0d}
    .rec-card[data-severity="medium"]{border-left:3px solid #e07d10}
    .rec-card[data-severity="low"]{border-left:3px solid #1a8a4a}
    .rec-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px}
    .rec-title{font-size:14px;font-weight:700;color:#202223;line-height:1.35;flex:1}
    .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0;margin-top:1px}
    .badge-high{background:#fef2f2;color:#b91c1c}
    .badge-medium{background:#fffbeb;color:#b45309}
    .badge-low{background:#f0fdf4;color:#15803d}
    .rec-category{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#8c9196;margin:0 0 8px}
    .rec-target{font-size:12px;color:#334155;margin:0 0 8px;padding:7px 10px;border-radius:7px;background:#f8fafc;border:1px solid #e2e8f0}
    .rec-target a{color:#005bd3;text-decoration:none;font-weight:600}
    .rec-target a:hover{text-decoration:underline}
    .rec-detail{font-size:12px;color:#6d7175;line-height:1.55;margin:0 0 10px}
    .rec-rationale{font-size:13px;color:#44474a;line-height:1.65;margin:0 0 6px}
    .rec-impact{font-size:12px;color:#008060;font-weight:600;margin:0;display:inline-flex;align-items:center;gap:4px}
    /* Loading skeleton */
    .skeleton{background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:6px}
    @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .skel-card{background:#fff;border:1px solid #e1e3e5;border-radius:10px;padding:18px 20px;margin-bottom:12px}
    .skel-line{height:13px;margin-bottom:10px}.skel-line:last-child{width:60%;margin-bottom:0}
    /* Empty & error states */
    .state-box{text-align:center;padding:48px 24px}
    .state-icon{font-size:32px;margin-bottom:12px}
    .state-title{font-size:16px;font-weight:700;color:#202223;margin:0 0 6px}
    .state-text{font-size:14px;color:#6d7175;margin:0 0 20px;line-height:1.5}
    /* Footer */
    .page-footer{margin-top:32px;padding-top:16px;border-top:1px solid #e1e3e5;font-size:13px;color:#8c9196;display:flex;gap:16px;flex-wrap:wrap}
    .page-footer a{color:#008060;text-decoration:none;font-weight:500}
    .page-footer a:hover{text-decoration:underline}`;
  }

  private getScanRunPageHtml(shop: string, apiUrl: string, homeUrl: string, recsUrl: string): string {
    const recsEsc = recsUrl.replace(/'/g, "\\'");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>Store scan — Conversion Optimizer</title>
  <style>${this.getBaseStyles()}</style>
</head>
<body>
  <div class="page-wrap">
    <nav class="page-nav">
      <a href="${homeUrl}" target="_top" class="page-nav-back">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Conversion Optimizer
      </a>
    </nav>
    <div class="page-heading">
      <h1>Store scan</h1>
      <p class="page-shop">${this.escapeHtml(shop)}</p>
    </div>

    <div class="card">
      <p class="scan-intro">Run a full analysis of your store — we check products, copy, trust signals, and your theme. You get a prioritized list of fixes ranked by impact.</p>
      <p class="card-title">What we analyze</p>
      <ul class="scan-checklist">
        <li>
          <span class="scan-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#15803d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span>Product titles, descriptions, images, and variants</span>
        </li>
        <li>
          <span class="scan-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#15803d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span>Trust signals — guarantees, shipping, returns, and contact info</span>
        </li>
        <li>
          <span class="scan-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#15803d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span>Theme layout and blocks on product and global pages</span>
        </li>
        <li>
          <span class="scan-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#15803d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span>Pricing and compare-at price consistency</span>
        </li>
      </ul>
      <p class="scan-note">Recommendations that suggest adding app blocks require an <strong>Online Store 2.0</strong> theme. <a href="https://help.shopify.com/en/manual/online-store/themes/managing-themes/versions#features" target="_blank" rel="noopener">Check your theme version →</a></p>
      <button type="button" id="runBtn" class="btn btn-primary btn-lg">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3.5l7 4.5-7 4.5V3.5z" fill="currentColor"/></svg>
        Start scan
      </button>
      <div id="result" class="scan-result"></div>
    </div>

    <footer class="page-footer">
      <a href="${homeUrl}" target="_top">← Back to app</a>
    </footer>
  </div>
  <script>
    (function() {
      var btn = document.getElementById('runBtn');
      var result = document.getElementById('result');
      var apiUrl = '${apiUrl.replace(/'/g, "\\'")}';
      var recsUrl = '${recsEsc}';
      btn.onclick = function() {
        btn.disabled = true;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="animation:spin .7s linear infinite"><path d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" stroke="rgba(255,255,255,.4)" stroke-width="2"/><path d="M8 2a6 6 0 0 1 6 6" stroke="white" stroke-width="2" stroke-linecap="round"/></svg> Scanning…';
        result.style.display = 'none';
        result.className = 'scan-result';
        fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3.5l7 4.5-7 4.5V3.5z" fill="currentColor"/></svg> Start scan';
            result.style.display = 'block';
            result.className = 'scan-result success';
            result.innerHTML = '<p class="sr-title">✓ Scan started</p><p class="sr-body">Your store is being analyzed. Once complete, head back to the app home and click <strong>View recommendations</strong> to see your prioritized list.</p><a href="' + recsUrl + '" target="_top" class="btn btn-primary">View recommendations</a>';
          })
          .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3.5l7 4.5-7 4.5V3.5z" fill="currentColor"/></svg> Start scan';
            result.style.display = 'block';
            result.className = 'scan-result error';
            result.innerHTML = '<p class="sr-title">Scan failed</p><p class="sr-body">' + (err.message || 'Something went wrong. Please try again or go back to the app.') + '</p>';
          });
      };
      var style = document.createElement('style');
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    })();
  </script>
  ${this.getDismissAppBridgeLoadingScript()}
</body>
</html>`;
  }

  private getRecommendationsPageHtml(shop: string, apiUrl: string, homeUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getAppBridgeHead()}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>Recommendations — Conversion Optimizer</title>
  <style>${this.getBaseStyles()}</style>
</head>
<body>
  <div class="page-wrap">
    <nav class="page-nav">
      <a href="${homeUrl}" target="_top" class="page-nav-back">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Conversion Optimizer
      </a>
    </nav>
    <div class="page-heading">
      <h1>Recommendations</h1>
      <p class="page-shop">${this.escapeHtml(shop)}</p>
    </div>

    <p class="rec-intro">Prioritized actions to improve your conversion rate. Tackle high-impact items first, then medium and low. Recommendations requiring theme blocks need an <a href="https://help.shopify.com/en/manual/online-store/themes/managing-themes/versions#features" target="_blank" rel="noopener">Online Store 2.0</a> theme.</p>

    <div id="loading">
      <div class="skel-card"><div class="skeleton skel-line" style="width:55%;height:15px;margin-bottom:12px"></div><div class="skeleton skel-line" style="width:100%"></div><div class="skeleton skel-line" style="width:85%"></div></div>
      <div class="skel-card"><div class="skeleton skel-line" style="width:70%;height:15px;margin-bottom:12px"></div><div class="skeleton skel-line" style="width:100%"></div><div class="skeleton skel-line" style="width:60%"></div></div>
      <div class="skel-card"><div class="skeleton skel-line" style="width:45%;height:15px;margin-bottom:12px"></div><div class="skeleton skel-line" style="width:100%"></div><div class="skeleton skel-line" style="width:78%"></div></div>
    </div>
    <div id="content" style="display:none;"></div>

    <footer class="page-footer">
      <a href="${homeUrl}" target="_top">← Back to app</a>
    </footer>
  </div>
  <script>
    (function() {
      var loading = document.getElementById('loading');
      var content = document.getElementById('content');
      var list = [];
      var currentFilter = 'all';
      function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
      function severityKey(s) {
        var sl = (s || '').toLowerCase();
        return sl.indexOf('high') >= 0 ? 'high' : sl.indexOf('medium') >= 0 ? 'medium' : 'low';
      }
      function severityLabel(s) {
        var k = severityKey(s);
        return k.charAt(0).toUpperCase() + k.slice(1);
      }
      function impactStr(imp) {
        if (!imp || imp.metric !== 'conversion_rate') return '';
        var lo = imp.low != null ? (imp.low * 100).toFixed(1) : '';
        var hi = imp.high != null ? (imp.high * 100).toFixed(1) : '';
        return (lo && hi) ? '+' + lo + '\\u2013' + hi + '% conversion rate' : '';
      }
      function renderRecs(filter) {
        currentFilter = filter;
        var filtered = filter === 'all' ? list : list.filter(function(r) { return severityKey(r.severity) === filter; });
        var counts = { high: 0, medium: 0, low: 0 };
        list.forEach(function(r) { counts[severityKey(r.severity)]++; });

        var cards = filtered.map(function(r) {
          var sk = severityKey(r.severity);
          var impact = impactStr(r.expectedImpact);
          var appliesTo = r.appliesTo || (r.entityType === 'global' ? 'Store-wide theme' : 'Product');
          var issueDetail = r.issueDetail || '';
          var appliesToHtml = r.targetUrl
            ? '<a href="https://${shop}/admin' + esc(r.targetUrl) + '" target="_blank" rel="noopener">' + esc(appliesTo) + '</a>'
            : esc(appliesTo);
          return '<article class="rec-card" data-severity="' + sk + '">' +
            '<div class="rec-card-head">' +
              '<span class="rec-title">' + esc(r.title || r.category) + '</span>' +
              '<span class="badge badge-' + sk + '">' + severityLabel(r.severity) + '</span>' +
            '</div>' +
            '<p class="rec-category">' + esc(r.category) + '</p>' +
            '<p class="rec-target"><strong>Applies to:</strong> ' + appliesToHtml + '</p>' +
            (issueDetail ? '<p class="rec-detail"><strong>Issue found:</strong> ' + esc(issueDetail) + '</p>' : '') +
            '<p class="rec-rationale">' + esc(r.rationale) + '</p>' +
            (impact ? '<p class="rec-impact"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' + esc(impact) + '</p>' : '') +
          '</article>';
        }).join('');

        var filterActiveClass = function(f) {
          var base = 'filter-btn';
          if (filter !== f) return base;
          if (f === 'all') return base + ' active';
          if (f === 'high') return base + ' active-high';
          if (f === 'medium') return base + ' active-medium';
          return base + ' active-low';
        };

        var summaryParts = [];
        if (counts.high) summaryParts.push('<strong>' + counts.high + ' high</strong>');
        if (counts.medium) summaryParts.push('<strong>' + counts.medium + ' medium</strong>');
        if (counts.low) summaryParts.push(counts.low + ' low');
        var summary = summaryParts.join(', ') + (counts.high ? ' — address high first' : '');

        var toolbar = '<div class="rec-toolbar">' +
          '<div class="rec-summary">' + summary + '</div>' +
          '<div class="rec-filters">' +
            '<button type="button" class="' + filterActiveClass('all') + '" data-filter="all">All (' + list.length + ')</button>' +
            (counts.high ? '<button type="button" class="' + filterActiveClass('high') + '" data-filter="high">High (' + counts.high + ')</button>' : '') +
            (counts.medium ? '<button type="button" class="' + filterActiveClass('medium') + '" data-filter="medium">Medium (' + counts.medium + ')</button>' : '') +
            (counts.low ? '<button type="button" class="' + filterActiveClass('low') + '" data-filter="low">Low (' + counts.low + ')</button>' : '') +
          '</div>' +
          '<button type="button" id="exportBtn" class="btn btn-secondary btn-sm">' +
            '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v8M3 6l3.5 3.5L10 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 10v1.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
            'Export CSV' +
          '</button>' +
        '</div>';

        var emptyMsg = '<div class="state-box"><p class="state-icon">\\uD83D\\uDD0D</p><p class="state-title">No ' + (filter !== 'all' ? filter + ' ' : '') + 'recommendations</p><p class="state-text">' + (filter !== 'all' ? 'Try switching to All to see everything.' : 'Run a scan from the app home to generate recommendations.') + '</p></div>';

        content.innerHTML = toolbar + '<div class="rec-list">' + (filtered.length ? cards : emptyMsg) + '</div>';

        content.querySelectorAll('.filter-btn').forEach(function(btn) {
          btn.onclick = function() { renderRecs(btn.getAttribute('data-filter')); };
        });

        var exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.onclick = function() {
          var q = function(s) { return '"' + (s == null ? '' : String(s)).replace(/"/g, '""').replace(/\\n/g, ' ').replace(/\\r/g, ' ') + '"'; };
          var exportedAt = new Date().toISOString().slice(0, 10);
          var csv = '\\uFEFF';
          csv += q('Conversion Optimizer \\u2014 CRO Recommendations Report') + ',,,,,,,\\n';
          csv += q('Exported') + ',' + q(exportedAt) + ',,,,,,\\n';
          csv += q('How to use') + ',' + q('Address High priority first, then Medium, then Low. Use Applies to + Issue found to locate the exact product or store area quickly.') + ',,,,,,\\n';
          csv += ',,,,,,,\\n';
          csv += q('#') + ',' + q('Recommendation') + ',' + q('Category') + ',' + q('Priority') + ',' + q('Applies to') + ',' + q('Issue found') + ',' + q('Rationale') + ',' + q('Expected impact') + '\\n';
          list.forEach(function(r, idx) {
            var imp = r.expectedImpact && r.expectedImpact.metric === 'conversion_rate' && r.expectedImpact.low != null && r.expectedImpact.high != null ? '+' + (r.expectedImpact.low * 100).toFixed(1) + '\\u2013' + (r.expectedImpact.high * 100).toFixed(1) + '%' : '';
            var priority = severityLabel(r.severity);
            csv += (idx + 1) + ',' + q(r.title || r.category || '') + ',' + q(r.category || '') + ',' + q(priority) + ',' + q(r.appliesTo || '') + ',' + q(r.issueDetail || '') + ',' + q(r.rationale || '') + ',' + q(imp) + '\\n';
          });
          var a = document.createElement('a');
          a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
          a.download = 'conversion-optimizer-recommendations-' + exportedAt + '.csv';
          a.click();
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
            content.innerHTML = '<div class="state-box"><p class="state-icon">\\uD83D\\uDCCA</p><p class="state-title">No recommendations yet</p><p class="state-text">Run a scan from the app home — we analyze your products, trust signals, and theme and build a prioritized list.</p><a href="${homeUrl}" target="_top" class="btn btn-primary">Back to app</a></div>';
            return;
          }
          renderRecs('all');
        })
        .catch(function(err) {
          loading.style.display = 'none';
          content.style.display = 'block';
          content.innerHTML = '<div class="state-box"><p class="state-icon">\\u26A0\\uFE0F</p><p class="state-title">Could not load recommendations</p><p class="state-text">' + (err.message || 'Request failed') + '. Please try again.</p><button class="btn btn-secondary" onclick="location.reload()">Retry</button></div>';
        });
    })();
  </script>
  ${this.getDismissAppBridgeLoadingScript()}
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
  <li><strong>Billing and plan:</strong> Whether you have an active subscription and which plan (Growth, Pro, or Pro Annual) so we can provide the correct features.</li>
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
