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
    // Favicon as data URI to avoid 404 (simple green dot)
    const favicon =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%23008060"/></svg>');

    const ctaCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Billing</h2><p class="card-text">Your store is on the <strong>$19/month</strong> plan.</p><a href="${subscribeUrl}" target="_top" class="btn btn-secondary">Manage billing</a></div>`
      : `<div class="card card-highlight"><h2 class="card-title">Get started</h2><p class="card-text">Subscribe to run CRO scans and view recommendations for your store.</p><a href="${subscribeUrl}" target="_top" class="btn btn-primary">Subscribe — $19/month</a></div>`;

    const scanRunUrl = `${baseUrl}/scan/run?shop=${shopEnc}`;
    const recsPageUrl = `${baseUrl}/recommendations?shop=${shopEnc}`;
    const actionsCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Actions</h2><div class="action-list"><div class="action-item"><a href="${scanRunUrl}" target="_top" class="btn btn-primary">Run scan</a><span class="action-desc">Analyze your store and generate CRO recommendations</span></div><div class="action-item"><a href="${recsPageUrl}" target="_top" class="btn btn-secondary">View recommendations</a><span class="action-desc">See your CRO recommendations in a clear list</span></div></div></div>`
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

  private getBaseStyles(): string {
    return `*{box-sizing:border-box}body{margin:0;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5;color:#202223;background:#f6f6f7;min-height:100vh}.container{max-width:640px;margin:0 auto}.page-header{margin-bottom:24px}.page-title{font-size:22px;font-weight:600;margin:0 0 4px 0;color:#202223}.page-subtitle{font-size:13px;color:#6d7175;margin:0}.card{background:#fff;border-radius:8px;box-shadow:0 1px 0 rgba(0,0,0,.05);padding:20px;margin-bottom:16px}.card-title{font-size:15px;font-weight:600;margin:0 0 12px 0;color:#202223}.card-text{margin:0 0 16px 0;color:#6d7175}.btn{display:inline-block;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;border:none;cursor:pointer;font-family:inherit}.btn-primary{background:#008060;color:#fff}.btn-primary:hover{background:#006e52}.btn-secondary{background:#f6f6f7;color:#202223;border:1px solid #c9cccf}.btn-secondary:hover{background:#e1e3e5}.btn:disabled{opacity:.6;cursor:not-allowed}.footer{margin-top:24px;font-size:12px;color:#6d7175}.footer a{color:#008060;text-decoration:none}.muted{color:#6d7175}.result-box{background:#f9fafb;border:1px solid #e1e3e5;border-radius:6px;padding:16px;margin-top:16px;font-size:13px;word-break:break-all}.result-box a{color:#008060;text-decoration:none}.result-box a:hover{text-decoration:underline}.table-wrap{overflow-x:auto}.table{width:100%;border-collapse:collapse;font-size:13px}.table th,.table td{padding:10px 12px;text-align:left;border-bottom:1px solid #e1e3e5}.table th{font-weight:600;color:#202223}.table tr:hover{background:#f9fafb}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500}.badge-high{background:#fef3f2;color:#b42318}.badge-medium{background:#fff4e5;color:#b54708}.badge-low{background:#e8f5e9;color:#2e7d32}.empty{text-align:center;padding:32px;color:#6d7175}`;
  }

  private getScanRunPageHtml(shop: string, apiUrl: string, homeUrl: string, recsUrl: string): string {
    const favicon =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%23008060"/></svg>');
    const recsEsc = recsUrl.replace(/'/g, "\\'");
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="${favicon}" type="image/svg+xml"><title>Run scan — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <header class="page-header"><h1 class="page-title">Run scan</h1><p class="page-subtitle">${shop}</p></header>
    <div class="card">
      <p class="card-text">Analyze your store and generate CRO recommendations. This may take a moment.</p>
      <button type="button" id="runBtn" class="btn btn-primary">Start scan</button>
      <div id="result" class="result-box" style="display:none;"></div>
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
            result.innerHTML = '<strong>Scan queued</strong><br>Job ID: ' + (data.jobId || '-') + '<br><br>Recommendations will appear after the scan finishes. <a href="' + recsUrl + '" target="_top">View recommendations</a> once ready.';
          })
          .catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Start scan';
            result.style.display = 'block';
            result.innerHTML = '<strong>Error</strong>: ' + (err.message || 'Request failed');
          });
      };
    })();
  </script>
</body>
</html>`;
  }

  private getRecommendationsPageHtml(shop: string, apiUrl: string, homeUrl: string): string {
    const favicon =
      'data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%23008060"/></svg>');
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="${favicon}" type="image/svg+xml"><title>Recommendations — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <header class="page-header"><h1 class="page-title">Recommendations</h1><p class="page-subtitle">${shop}</p></header>
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
      fetch('${apiUrl.replace(/'/g, "\\'")}')
        .then(function(r) {
          if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
          return r.json();
        })
        .then(function(list) {
          loading.style.display = 'none';
          content.style.display = 'block';
          if (!list || list.length === 0) {
            content.innerHTML = '<p class="empty">No recommendations yet. Run a scan from the app home to generate them.</p>';
            return;
          }
          var esc = function(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
          var severityClass = function(s) { return (s || '').toLowerCase().indexOf('high') >= 0 ? 'badge-high' : (s || '').toLowerCase().indexOf('medium') >= 0 ? 'badge-medium' : 'badge-low'; };
          var html = '<div class="table-wrap"><table class="table"><thead><tr><th>Category</th><th>Severity</th><th>Rationale</th></tr></thead><tbody>';
          for (var i = 0; i < list.length; i++) {
            var r = list[i];
            html += '<tr><td>' + esc(r.category) + '</td><td><span class="badge ' + severityClass(r.severity) + '">' + esc(r.severity) + '</span></td><td>' + esc(r.rationale) + '</td></tr>';
          }
          html += '</tbody></table></div>';
          content.innerHTML = html;
        })
        .catch(function(err) {
          loading.style.display = 'none';
          content.style.display = 'block';
          content.innerHTML = '<p class="muted">Could not load recommendations: ' + (err.message || 'Request failed') + '</p>';
        });
    })();
  </script>
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
