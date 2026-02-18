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

    const hasPlan = this.shops.hasPaidPlan(existing);
    const currentPlanLabel = this.shops.getPlanLabel(existing);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(this.getAppHomeHtml(normalized, hasPlan, currentPlanLabel, baseUrl));
  }

  private getAppHomeHtml(shop: string, hasPlan: boolean, currentPlanLabel: string, baseUrl: string): string {
    const title = 'Conversion Optimizer';
    const shopEnc = encodeURIComponent(shop);
    const statusUrl = `${baseUrl}/api/billing/status?shop=${shopEnc}`;
    const scanRunUrl = `${baseUrl}/scan/run?shop=${shopEnc}`;
    const recsPageUrl = `${baseUrl}/recommendations?shop=${shopEnc}`;
    const subscribeBase = `${baseUrl}/api/billing/subscribe?shop=${shopEnc}`;

    const plansDisplay = [
      { key: 'starter', name: 'Starter', price: 9, desc: 'Store scan, prioritized recommendations, filter by severity, export CSV.' },
      { key: 'growth', name: 'Growth', price: 19, desc: 'Everything in Starter. Best for growing stores.', popular: true },
      { key: 'pro', name: 'Pro', price: 29, desc: 'Everything in Growth. For teams and high-volume stores.' },
    ];

    const ctaCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Billing</h2><p class="card-text">Your plan: <strong>${currentPlanLabel}</strong>. Full access to scans and recommendations.</p><a href="${subscribeBase}" target="_top" class="btn btn-secondary">Manage billing</a></div>`
      : `<div class="card"><h2 class="card-title">Plans</h2><p class="card-text" style="margin-bottom:16px;">Choose a plan. All include store scan, recommendations, and CSV export.</p><div class="plans-grid">${plansDisplay.map((p) => `<div class="plan-card${p.popular ? ' plan-popular' : ''}"><div class="plan-name">${p.name}</div><div class="plan-price">$${p.price}<span class="plan-period">/mo</span></div><p class="plan-desc">${p.desc}</p><a href="${subscribeBase}&plan=${p.key}" target="_top" class="btn ${p.popular ? 'btn-primary' : 'btn-secondary'}">Subscribe</a></div>`).join('')}</div></div>`;

    const actionsCard = hasPlan
      ? `<div class="card"><h2 class="card-title">Actions</h2><div class="action-list"><div class="action-item"><a href="${scanRunUrl}" target="_top" class="btn btn-primary">Run scan</a><span class="action-desc">Analyze your store and generate CRO recommendations</span></div><div class="action-item"><a href="${recsPageUrl}" target="_top" class="btn btn-secondary">View recommendations</a><span class="action-desc">See your CRO recommendations in a clear list</span></div></div></div>`
      : '<div class="card"><p class="card-text muted">Run scan and View recommendations unlock after you subscribe.</p></div>';

    const featuresHtml = `
    <ul class="feature-list">
      <li><strong>Store scan</strong> — Analyzes your products and theme and surfaces gaps.</li>
      <li><strong>Prioritized list</strong> — High, medium, and low severity so you fix what matters first.</li>
      <li><strong>Actionable rationales</strong> — Each recommendation explains what to change and why.</li>
    </ul>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #202223; background: #fff; min-height: 100vh; }
    .container { max-width: 560px; margin: 0 auto; }
    .app-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .app-logo-icon { height: 28px; width: 28px; display: block; flex-shrink: 0; }
    .app-wordmark { font-size: 17px; font-weight: 600; color: #202223; letter-spacing: -0.02em; }
    .shop-badge { font-size: 12px; color: #6d7175; font-weight: 500; }
    .hero-line { font-size: 15px; color: #202223; margin: 0 0 24px 0; padding-bottom: 24px; border-bottom: 1px solid #e1e3e5; }
    .hero-line strong { font-weight: 600; }
    .feature-list { margin: 0 0 28px 0; padding-left: 20px; color: #44474a; font-size: 14px; line-height: 1.6; }
    .feature-list li { margin-bottom: 8px; }
    .card { background: #fafbfb; border: 1px solid #e1e3e5; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .card-highlight { border-color: #008060; background: #f9fafb; }
    .card-title { font-size: 13px; font-weight: 600; margin: 0 0 8px 0; color: #202223; letter-spacing: 0.02em; text-transform: uppercase; }
    .card-text { margin: 0 0 14px 0; color: #6d7175; font-size: 14px; }
    .card-text.muted { margin: 0; }
    .btn { display: inline-block; padding: 10px 18px; border-radius: 6px; font-size: 14px; font-weight: 500; text-decoration: none; border: none; cursor: pointer; font-family: inherit; }
    .btn-primary { background: #008060; color: #fff; }
    .btn-primary:hover { background: #006e52; }
    .btn-secondary { background: #fff; color: #202223; border: 1px solid #c9cccf; }
    .btn-secondary:hover { background: #f6f6f7; }
    .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
    .plan-card { background: #fff; border: 1px solid #e1e3e5; border-radius: 8px; padding: 18px; }
    .plan-card.plan-popular { border-color: #008060; background: #f9fafb; }
    .plan-name { font-size: 13px; font-weight: 600; color: #202223; margin-bottom: 4px; }
    .plan-price { font-size: 22px; font-weight: 600; color: #202223; }
    .plan-period { font-size: 13px; font-weight: 400; color: #6d7175; }
    .plan-desc { font-size: 12px; color: #6d7175; line-height: 1.4; margin: 10px 0 14px 0; }
    .plan-card .btn { width: 100%; text-align: center; }
    .action-list { display: flex; flex-direction: column; gap: 12px; }
    .action-item { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .action-desc { font-size: 13px; color: #6d7175; }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e1e3e5; font-size: 12px; color: #6d7175; }
    .footer a { color: #008060; text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header class="app-header">
      <div class="brand"><img src="/logo.svg" alt="" class="app-logo-icon"><span class="app-wordmark">${title}</span></div>
      <span class="shop-badge">${shop}</span>
    </header>
    <p class="hero-line"><strong>Conversion Optimizer</strong> gives you a prioritized list of changes to improve your store. Run a scan, then work through recommendations by severity.</p>
    ${featuresHtml}
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
    return `*{box-sizing:border-box}body{margin:0;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.55;color:#202223;background:#f6f6f7;min-height:100vh}.container{max-width:680px;margin:0 auto}.page-header{margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid #e1e3e5}.page-header-with-logo{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.page-header-with-logo .logo-link{text-decoration:none;display:flex;align-items:center;gap:8px}.page-header-with-logo .app-logo-small{height:24px;width:24px;display:block;flex-shrink:0}.page-header-with-logo .app-wordmark-sub{font-size:15px;font-weight:600;color:#202223}.page-title{font-size:24px;font-weight:600;margin:0 0 6px 0;color:#202223;letter-spacing:-0.02em}.page-subtitle{font-size:13px;color:#6d7175;margin:0}.card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:24px;margin-bottom:20px;border:1px solid rgba(0,0,0,.04)}.card-title{font-size:15px;font-weight:600;margin:0 0 12px 0;color:#202223}.card-text{margin:0 0 20px 0;color:#6d7175;font-size:14px}.btn{display:inline-block;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;border:none;cursor:pointer;font-family:inherit;transition:background .15s}.btn-primary{background:#008060;color:#fff}.btn-primary:hover{background:#006e52}.btn-secondary{background:#f6f6f7;color:#202223;border:1px solid #c9cccf}.btn-secondary:hover{background:#e1e3e5}.btn:disabled{opacity:.6;cursor:not-allowed}.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e1e3e5;font-size:13px;color:#6d7175}.footer a{color:#008060;text-decoration:none;font-weight:500}.footer a:hover{text-decoration:underline}.muted{color:#6d7175}.hero{font-size:15px;color:#202223;margin:0 0 20px 0;line-height:1.6}.steps{margin:0 0 24px 0;padding-left:20px}.steps li{margin-bottom:8px;color:#6d7175}.success-card{background:linear-gradient(180deg,#f0fdf4 0%,#fff 100%);border:1px solid #86efac;padding:20px;border-radius:10px;margin-top:20px}.success-card .title{font-size:15px;font-weight:600;color:#166534;margin:0 0 8px 0}.success-card .detail{font-size:12px;color:#6d7175;font-family:ui-monospace,monospace;word-break:break-all;margin:8px 0 16px 0}.success-card .next{font-size:13px;color:#6d7175;margin:0 0 12px 0}.result-box{background:#f9fafb;border:1px solid #e1e3e5;border-radius:8px;padding:20px;margin-top:20px;font-size:13px;word-break:break-all}.result-box a{color:#008060;text-decoration:none;font-weight:500}.result-box a:hover{text-decoration:underline}.intro-block{margin-bottom:24px;padding:16px 20px;background:#f9fafb;border-radius:8px;border-left:4px solid #008060}.intro-block .intro-title{font-size:13px;font-weight:600;color:#202223;margin:0 0 6px 0}.intro-block .intro-text{font-size:13px;color:#6d7175;margin:0;line-height:1.5}.scan-lead{margin:0 0 20px 0;font-size:14px;color:#202223;line-height:1.5}.scan-what-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#6d7175;margin:0 0 10px 0}.scan-what-list{margin:0 0 20px 0;padding-left:20px;font-size:13px;color:#44474a;line-height:1.6}.scan-what-list li{margin-bottom:6px}.scan-steps{margin:0 0 20px 0;font-size:13px;color:#6d7175;line-height:1.5}.table-wrap{overflow-x:auto;margin-top:16px}.table{width:100%;border-collapse:collapse;font-size:13px}.table th,.table td{padding:12px 16px;text-align:left;border-bottom:1px solid #e1e3e5}.table th{font-weight:600;color:#202223;background:#fafbfb;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.table tr:hover{background:#f9fafb}.table td{vertical-align:top}.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}.badge-high{background:#fef2f2;color:#b91c1c}.badge-medium{background:#fffbeb;color:#b45309}.badge-low{background:#f0fdf4;color:#15803d}.empty{text-align:center;padding:48px 24px;color:#6d7175}.empty .empty-title{font-size:15px;font-weight:600;color:#202223;margin:0 0 8px 0}.empty .empty-text{font-size:14px;margin:0;line-height:1.5}.count-bar{font-size:13px;color:#6d7175;margin-bottom:12px}.count-bar strong{color:#202223}.rec-intro{margin:0 0 20px 0;font-size:14px;color:#44474a;line-height:1.5}.rec-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e1e3e5}.rec-summary{font-size:13px;color:#6d7175;flex:1;min-width:120px}.rec-filters{display:flex;gap:6px}.filter-btn{padding:6px 12px;border:1px solid #c9cccf;background:#fff;border-radius:6px;font-size:12px;cursor:pointer;color:#44474a;font-family:inherit}.filter-btn:hover{background:#f6f6f7}.filter-btn.active{background:#202223;color:#fff;border-color:#202223}.btn-sm{padding:6px 12px;font-size:12px}.rec-list{display:flex;flex-direction:column;gap:16px}.rec-card{background:#fafbfb;border:1px solid #e1e3e5;border-radius:8px;padding:18px}.rec-card-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.rec-title{font-size:14px;font-weight:600;color:#202223}.rec-category{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6d7175;display:block;margin-bottom:10px}.rec-rationale{font-size:13px;color:#44474a;line-height:1.6;margin:0 0 8px 0}.rec-impact{font-size:12px;color:#008060;margin:0;font-weight:500}`;
  }

  private getScanRunPageHtml(shop: string, apiUrl: string, homeUrl: string, recsUrl: string): string {
    const recsEsc = recsUrl.replace(/'/g, "\\'");
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Run scan — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
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
            result.innerHTML = '<p class="title">Scan queued</p><p class="next">Your store is being analyzed. Open View recommendations in a moment to see your prioritized list.</p><a href="' + recsUrl + '" target="_top" class="btn btn-primary">View recommendations</a>';
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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Recommendations — Conversion Optimizer</title><style>${this.getBaseStyles()}</style></head>
<body>
  <div class="container">
    <header class="page-header page-header-with-logo">
      <a href="${homeUrl}" target="_top" class="logo-link"><img src="/logo.svg" alt="" class="app-logo-small"><span class="app-wordmark-sub">Conversion Optimizer</span></a>
      <div><h1 class="page-title">Recommendations</h1><p class="page-subtitle">${shop}</p></div>
    </header>
    <p class="rec-intro">Prioritized actions to improve conversion. Tackle high-impact items first, then medium and low.</p>
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
