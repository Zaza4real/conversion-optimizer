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
    const cta = hasPlan
      ? '<p><a href="' + subscribeUrl + '" target="_top">Manage billing</a></p>'
      : '<p><strong><a href="' + subscribeUrl + '" target="_top">Subscribe for $19/month</a></strong> to run scans and get recommendations.</p>';
    const statusUrl = subscribeUrl.replace('/billing/subscribe', '/billing/status');
    const shopEnc = encodeURIComponent(shop);
    const scanUrl = `${baseUrl}/api/scan/${shopEnc}`;
    const recsUrl = `${baseUrl}/api/recommendations/${shopEnc}?limit=10`;
    const testSection = hasPlan
      ? `<h2>Test</h2>
<ul>
  <li><form action="${scanUrl}" method="post" target="_top" style="display:inline;"><button type="submit">Run scan</button></form> — enqueues a CRO scan for your store</li>
  <li><a href="${recsUrl}" target="_top">View recommendations</a> — returns JSON (or open in new tab)</li>
</ul>`
      : '<p><small>Subscribe above to unlock <strong>Run scan</strong> and <strong>View recommendations</strong>.</small></p>';
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:40em;margin:2em auto;padding:0 1em;} a{color:#008060;} code{background:#eee;padding:2px 6px;}</style></head>
<body>
<h1>${title}</h1>
<p>Store: <strong>${shop}</strong></p>
${cta}
<p><small>API: <a href="${statusUrl}" target="_top">billing status</a></small></p>
${testSection}
</body></html>`;
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
