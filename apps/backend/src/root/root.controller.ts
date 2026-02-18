import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ShopsService } from '../shops/shops.service';

/**
 * Handles GET / (Shopify app load in Admin iframe). Excluded from global "api" prefix.
 * - If shop not installed: serve HTML that redirects the top window to OAuth (break out of iframe).
 * - If shop installed: serve a minimal app home so the iframe shows content (avoids redirect loop).
 */
@Controller()
export class RootController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  async index(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();
    if (!shop) {
      res.status(400).send('Missing shop parameter. Use /api/auth?shop=your-store.myshopify.com');
      return;
    }
    const normalized = this.normalizeShop(shop);
    const existing = await this.shops.findByDomain(normalized);
    const baseUrl = this.getBaseUrl(req);

    if (!existing) {
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
    res.send(this.getAppHomeHtml(normalized, subscribeUrl, hasPlan));
  }

  private getAppHomeHtml(shop: string, subscribeUrl: string, hasPlan: boolean): string {
    const title = 'Conversion Optimizer';
    const cta = hasPlan
      ? '<p><a href="' + subscribeUrl + '">Manage billing</a></p>'
      : '<p><strong><a href="' + subscribeUrl + '">Subscribe for $19/month</a></strong> to run scans and get recommendations.</p>';
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:40em;margin:2em auto;padding:0 1em;} a{color:#008060;}</style></head>
<body>
<h1>${title}</h1>
<p>Store: <strong>${shop}</strong></p>
${cta}
<p><small>API: <a href="${subscribeUrl.replace('/billing/subscribe', '/billing/status')}">billing status</a> · scan and recommendations require a subscription.</small></p>
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
