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

  /** Serve app favicon (PNG) at /favicon.ico for browser tab icon */
  @Get('favicon.ico')
  favicon(@Res() res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const faviconPath = path.join(__dirname, '..', '..', 'public', 'favicon.png');
    res.sendFile(faviconPath, (err: Error) => {
      if (err) res.status(204).send();
    });
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(this.getAppHomeHtml(normalized, subscribeUrl, hasPlan, baseUrl));
  }

  private getAppHomeHtml(shop: string, subscribeUrl: string, hasPlan: boolean, baseUrl: string): string {
    const title = 'Conversion Optimizer';
    const statusUrl = subscribeUrl.replace('/billing/subscribe', '/billing/status');
    const shopEnc = encodeURIComponent(shop);
    const scanRunUrl = `${baseUrl}/scan/run?shop=${shopEnc}`;
    const recsPageUrl = `${baseUrl}/recommendations?shop=${shopEnc}`;

    const ctaCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Billing</h2><p class="card-text">Your store is on the <strong>$19/month</strong> plan. You have full access to scans and recommendations.</p><a href="${subscribeUrl}" target="_top" class="btn btn-secondary">Manage billing</a></div>`
      : `<div class="card card-highlight"><h2 class="card-title">Get started</h2><p class="card-text">Subscribe once to unlock store scans and prioritized CRO recommendations. One plan, no per-scan fees.</p><a href="${subscribeUrl}" target="_top" class="btn btn-primary">Subscribe — $19/month</a></div>`;

    const actionsCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Actions</h2><div class="action-list"><div class="action-item"><a href="${scanRunUrl}" target="_top" class="btn btn-primary">Run scan</a><span class="action-desc">Analyze your store and generate CRO recommendations</span></div><div class="action-item"><a href="${recsPageUrl}" target="_top" class="btn btn-secondary">View recommendations</a><span class="action-desc">See your CRO recommendations in a clear list</span></div></div></div>`
      : '<div class="card"><p class="card-text muted">Run scan and View recommendations unlock after you subscribe.</p></div>';

    const featuresHtml = `
    <div class="features">
      <div class="feature"><span class="feature-icon">📊</span><span class="feature-text"><strong>Store scan</strong> — We analyze your products and theme so you don't have to guess.</span></div>
      <div class="feature"><span class="feature-icon">🎯</span><span class="feature-text"><strong>Prioritized recommendations</strong> — High, medium, and low severity so you know what to fix first.</span></div>
      <div class="feature"><span class="feature-icon">✓</span><span class="feature-text"><strong>CRO best practices</strong> — Actionable rationales based on conversion optimization standards.</span></div>
    </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.55; color: #202223; background: #f6f6f7; min-height: 100vh; }
    .container { max-width: 640px; margin: 0 auto; }
    .app-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e1e3e5; }
    .app-logo { height: 36px; width: auto; display: block; }
    .shop-badge { font-size: 13px; color: #6d7175; background: #f1f1f2; padding: 6px 12px; border-radius: 8px; }
    .hero-block { background: linear-gradient(135deg, #008060 0%, #006e52 100%); color: #fff; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .hero-block h2 { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; letter-spacing: -0.02em; }
    .hero-block p { margin: 0; font-size: 14px; opacity: .95; line-height: 1.5; }
    .features { margin-bottom: 24px; }
    .feature { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; font-size: 13px; color: #6d7175; }
    .feature-icon { font-size: 18px; flex-shrink: 0; }
    .feature-text { line-height: 1.45; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.06); padding: 24px; margin-bottom: 20px; border: 1px solid rgba(0,0,0,.04); }
    .card-highlight { border-left: 4px solid #008060; }
    .card-title { font-size: 15px; font-weight: 600; margin: 0 0 12px 0; color: #202223; }
    .card-text { margin: 0 0 16px 0; color: #6d7175; }
    .card-text.muted { margin: 0; }
    .btn { display: inline-block; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; border: none; cursor: pointer; font-family: inherit; transition: background .15s; }
    .btn-primary { background: #008060; color: #fff; }
    .btn-primary:hover { background: #006e52; }
    .btn-secondary { background: #f6f6f7; color: #202223; border: 1px solid #c9cccf; }
    .btn-secondary:hover { background: #e1e3e5; }
    .action-list { display: flex; flex-direction: column; gap: 16px; }
    .action-item { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .action-desc { font-size: 13px; color: #6d7175; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e1e3e5; font-size: 13px; color: #6d7175; display: flex; flex-wrap: wrap; gap: 16px; }
    .footer a { color: #008060; text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; }
    .footer-version { color: #9ca3af; font-weight: normal; }
  </style>
</head>
<body>
  <div class="container">
    <header class="app-header">
      <img src="/logo.png" alt="${title}" class="app-logo">
      <span class="shop-badge">${shop}</span>
    </header>
    <div class="hero-block">
      <h2>Turn more visitors into customers</h2>
      <p>Get clear, prioritized recommendations to improve your store's conversion rate. Scan once, act on what matters most.</p>
    </div>
    ${featuresHtml}
    ${ctaCard}
    ${actionsCard}
    <footer class="footer">
      <a href="${statusUrl}" target="_top">Billing status</a>
      <span class="footer-version">· App v2</span>
    </footer>
  </div>
</body>
</html>`;
  }

  private getBaseStyles(): string {
    return `*{box-sizing:border-box}body{margin:0;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.55;color:#202223;background:#f6f6f7;min-height:100vh}.container{max-width:680px;margin:0 auto}.page-header{margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid #e1e3e5}.page-header-with-logo{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.page-header-with-logo .logo-link{text-decoration:none}.page-header-with-logo .app-logo-small{height:32px;width:auto;display:block}.page-title{font-size:24px;font-weight:600;margin:0 0 6px 0;color:#202223;letter-spacing:-0.02em}.page-subtitle{font-size:13px;color:#6d7175;margin:0}.card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:24px;margin-bottom:20px;border:1px solid rgba(0,0,0,.04)}.card-title{font-size:15px;font-weight:600;margin:0 0 12px 0;color:#202223}.card-text{margin:0 0 20px 0;color:#6d7175;font-size:14px}.btn{display:inline-block;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;border:none;cursor:pointer;font-family:inherit;transition:background .15s}.btn-primary{background:#008060;color:#fff}.btn-primary:hover{background:#006e52}.btn-secondary{background:#f6f6f7;color:#202223;border:1px solid #c9cccf}.btn-secondary:hover{background:#e1e3e5}.btn:disabled{opacity:.6;cursor:not-allowed}.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e1e3e5;font-size:13px;color:#6d7175}.footer a{color:#008060;text-decoration:none;font-weight:500}.footer a:hover{text-decoration:underline}.muted{color:#6d7175}.hero{font-size:15px;color:#202223;margin:0 0 20px 0;line-height:1.6}.steps{margin:0 0 24px 0;padding-left:20px}.steps li{margin-bottom:8px;color:#6d7175}.success-card{background:linear-gradient(180deg,#f0fdf4 0%,#fff 100%);border:1px solid #86efac;padding:20px;border-radius:10px;margin-top:20px}.success-card .title{font-size:15px;font-weight:600;color:#166534;margin:0 0 8px 0}.success-card .detail{font-size:12px;color:#6d7175;font-family:ui-monospace,monospace;word-break:break-all;margin:8px 0 16px 0}.success-card .next{font-size:13px;color:#6d7175;margin:0 0 12px 0}.result-box{background:#f9fafb;border:1px solid #e1e3e5;border-radius:8px;padding:20px;margin-top:20px;font-size:13px;word-break:break-all}.result-box a{color:#008060;text-decoration:none;font-weight:500}.result-box a:hover{text-decoration:underline}.intro-block{margin-bottom:24px;padding:16px 20px;background:#f9fafb;border-radius:8px;border-left:4px solid #008060}.intro-block .intro-title{font-size:13px;font-weight:600;color:#202223;margin:0 0 6px 0}.intro-block .intro-text{font-size:13px;color:#6d7175;margin:0;line-height:1.5}.table-wrap{overflow-x:auto;margin-top:16px}.table{width:100%;border-collapse:collapse;font-size:13px}.table th,.table td{padding:12px 16px;text-align:left;border-bottom:1px solid #e1e3e5}.table th{font-weight:600;color:#202223;background:#fafbfb;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.table tr:hover{background:#f9fafb}.table td{vertical-align:top}.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}.badge-high{background:#fef2f2;color:#b91c1c}.badge-medium{background:#fffbeb;color:#b45309}.badge-low{background:#f0fdf4;color:#15803d}.empty{text-align:center;padding:48px 24px;color:#6d7175}.empty .empty-title{font-size:15px;font-weight:600;color:#202223;margin:0 0 8px 0}.empty .empty-text{font-size:14px;margin:0;line-height:1.5}.count-bar{font-size:13px;color:#6d7175;margin-bottom:12px}.count-bar strong{color:#202223}`;
  }

  private getScanRunPageHtml(shop: string, apiUrl: string, homeUrl: string, recsUrl: string): string {
    const recsEsc = recsUrl.replace(/'/g, "\\'");
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.ico" type="image/x-icon"><title>Run scan — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <header class="page-header page-header-with-logo">
      <a href="${homeUrl}" target="_top" class="logo-link"><img src="/logo.png" alt="Conversion Optimizer" class="app-logo-small"></a>
      <div><h1 class="page-title">Store scan</h1><p class="page-subtitle">${shop}</p></div>
    </header>
    <div class="card">
      <p class="hero">Analyze your store and generate conversion recommendations. We'll check your products and theme and prioritize actions by impact.</p>
      <div class="intro-block">
        <p class="intro-title">How it works</p>
        <p class="intro-text">Click <strong>Start scan</strong> below. The scan runs in the background. When it finishes, open <strong>View recommendations</strong> to see prioritized, actionable items.</p>
      </div>
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
        btn.textContent = 'Running scan…';
        result.style.display = 'none';
        fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            btn.disabled = false;
            btn.textContent = 'Start scan';
            result.style.display = 'block';
            result.className = 'success-card';
            result.innerHTML = '<p class="title">Scan started</p><p class="next">Your store is being analyzed. Recommendations will be ready in a moment.</p><p class="detail">Job: ' + (data.jobId || '-') + '</p><a href="' + recsUrl + '" target="_top" class="btn btn-primary">View recommendations</a>';
          })
          .catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Start scan';
            result.style.display = 'block';
            result.className = 'result-box';
            result.innerHTML = '<strong>Something went wrong</strong><br>' + (err.message || 'Request failed. Try again or go back to the app.');
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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.ico" type="image/x-icon"><title>Recommendations — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <header class="page-header page-header-with-logo">
      <a href="${homeUrl}" target="_top" class="logo-link"><img src="/logo.png" alt="Conversion Optimizer" class="app-logo-small"></a>
      <div><h1 class="page-title">Recommendations</h1><p class="page-subtitle">${shop}</p></div>
    </header>
    <div class="intro-block">
      <p class="intro-title">Your conversion recommendations</p>
      <p class="intro-text">Prioritize by <strong>severity</strong> — tackle high-impact items first, then medium and low. Each row explains what to improve and why.</p>
    </div>
    <div class="card">
      <div id="loading" class="card-text">Loading recommendations…</div>
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
            content.innerHTML = '<div class="empty"><p class="empty-title">No recommendations yet</p><p class="empty-text">Run a scan from the app home to analyze your store and generate prioritized actions.</p></div>';
            return;
          }
          var esc = function(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
          var severityClass = function(s) { return (s || '').toLowerCase().indexOf('high') >= 0 ? 'badge-high' : (s || '').toLowerCase().indexOf('medium') >= 0 ? 'badge-medium' : 'badge-low'; };
          var countBar = '<div class="count-bar">Showing ' + list.length + ' recommendation' + (list.length === 1 ? '' : 's') + '</div>';
          var html = countBar + '<div class="table-wrap"><table class="table"><thead><tr><th>Category</th><th>Severity</th><th>Rationale</th></tr></thead><tbody>';
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
          content.innerHTML = '<p class="muted">Could not load recommendations: ' + (err.message || 'Request failed') + '. Try again or go back to the app.</p>';
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
