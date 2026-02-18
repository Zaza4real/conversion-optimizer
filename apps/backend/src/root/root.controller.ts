import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
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

  /** Avoid 404 when browser requests /favicon.ico */
  @Get('favicon.ico')
  favicon(@Res() res: Response) {
    res.status(204).send();
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
      res.status(400).send('Missing shop parameter. Use /api/auth?shop=your-store.myshopify.com');
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

    const subscribeUrl = `${baseUrl}/api/billing/subscribe?shop=${encodeURIComponent(normalized)}`;
    const hasPlan = this.shops.hasPaidPlan(existing);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.getAppHomeHtml(normalized, subscribeUrl, hasPlan, baseUrl));
  }

  private getAppHomeHtml(shop: string, subscribeUrl: string, hasPlan: boolean, baseUrl: string): string {
    const title = 'Conversion Optimizer';
    const statusUrl = subscribeUrl.replace('/billing/subscribe', '/billing/status');
    const shopEnc = encodeURIComponent(shop);
    const scanUrl = `${baseUrl}/api/scan/${shopEnc}`;
    const recsUrl = `${baseUrl}/api/recommendations/${shopEnc}?limit=10`;
    // Favicon as data URI to avoid 404 (simple green dot)
    const favicon =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%23008060"/></svg>');

    const ctaCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Billing</h2><p class="card-text">Your store is on the <strong>$19/month</strong> plan.</p><a href="${subscribeUrl}" target="_top" class="btn btn-secondary">Manage billing</a></div>`
      : `<div class="card card-highlight"><h2 class="card-title">Get started</h2><p class="card-text">Subscribe to run CRO scans and view recommendations for your store.</p><a href="${subscribeUrl}" target="_top" class="btn btn-primary">Subscribe — $19/month</a></div>`;

    const actionsCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Actions</h2><div class="action-list"><form action="${scanUrl}" method="post" target="_top" class="action-item"><button type="submit" class="btn btn-primary">Run scan</button><span class="action-desc">Analyze your store and generate CRO recommendations</span></form><div class="action-item"><a href="${recsUrl}" target="_top" class="btn btn-secondary">View recommendations</a><span class="action-desc">Open recommendations JSON in a new tab</span></div></div></div>`
      : '<div class="card"><p class="card-text muted">Run scan and View recommendations unlock after you subscribe.</p></div>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="${favicon}" type="image/svg+xml">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #202223;
      background: #f6f6f7;
      min-height: 100vh;
    }
    .container { max-width: 560px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 22px; font-weight: 600; margin: 0 0 4px 0; color: #202223; }
    .page-subtitle { font-size: 13px; color: #6d7175; margin: 0; }
    .card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 0 rgba(0,0,0,.05);
      padding: 20px;
      margin-bottom: 16px;
    }
    .card-highlight { border-left: 4px solid #008060; }
    .card-title { font-size: 15px; font-weight: 600; margin: 0 0 8px 0; color: #202223; }
    .card-text { margin: 0 0 16px 0; color: #6d7175; }
    .card-text.muted { margin: 0; }
    .btn {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-primary { background: #008060; color: #fff; }
    .btn-primary:hover { background: #006e52; }
    .btn-secondary { background: #f6f6f7; color: #202223; border: 1px solid #c9cccf; }
    .btn-secondary:hover { background: #e1e3e5; }
    .action-list { display: flex; flex-direction: column; gap: 16px; }
    .action-item { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .action-desc { font-size: 13px; color: #6d7175; }
    .footer { margin-top: 24px; font-size: 12px; color: #6d7175; }
    .footer a { color: #008060; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">${title}</h1>
      <p class="page-subtitle">${shop}</p>
    </header>
    ${ctaCard}
    ${actionsCard}
    <footer class="footer">
      <a href="${statusUrl}" target="_top">Billing status</a>
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
