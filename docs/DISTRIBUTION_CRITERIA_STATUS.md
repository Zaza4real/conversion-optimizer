# Shopify Distribution Technical Criteria – Status

This doc maps the **Distribution** technical criteria (Partners → ConversionOptimizer → Distribution) to the current app so you know what’s met and what’s not.

---

## 1. Performance

### Meets benchmarks for 2025 Core Web Vitals

- **LCP &lt; 2.5s, CLS &lt; 0.1, INP &lt; 200ms** in the admin with 100+ calls.
- **Current:** The app is mostly server-rendered HTML from the backend (no heavy JS). That can perform well, but Shopify measures the **embedded app** (the iframe). You only get a pass once there’s enough traffic (100+ calls) and the metrics are within range.
- **CLS note (from Shopify):** “Make sure your app is embedded and uses a version of App Bridge that supports admin performance.” Our main app UI is backend HTML, so we don’t use App Bridge on those pages (see “Embedded in Shopify admin” below).

### Minimizes impact on storefront loading speed

- No storefront impact from the admin app. Theme extension assets are loaded by Shopify when the merchant adds blocks; we don’t inject scripts on every storefront load.

---

## 2. Design and functionality

### Is embedded in the Shopify admin

Shopify expects:

1. **Enable app embedding**  
   - **Status: ✅** Backend allows embedding via `Content-Security-Policy: frame-ancestors` (e.g. `https://admin.shopify.com`, `https://*.myshopify.com`). The app loads in the Admin iframe.

2. **Use session token authentication**  
   - **Status: ❌** The app uses **OAuth access tokens** stored in the database (encrypted). It does **not** use session tokens (JWT from App Bridge `getSessionToken()`).  
   - To meet this you’d need to: load App Bridge on the embedded app, call `getSessionToken()`, and send that token to the backend; backend verifies the JWT with Shopify instead of (or in addition to) using the stored access token.

3. **Use the latest version of App Bridge on every page of your app**  
   - **Status: ❌** The **main app UI** (app home, Run scan, Recommendations, Support/Privacy/Refund) is served by the **backend** as plain HTML. Those pages do **not** include App Bridge.  
   - The **admin** app (Next.js + Polaris) has `@shopify/app-bridge-react` and is embedded when `apiKey` and `isEmbedded` are set, but the **App URL** in Partners is almost certainly the **backend** URL. So the “every page” that merchants see in the iframe has no App Bridge.  
   - To meet this you’d either: (a) switch the App URL to the admin app and ensure every route uses App Bridge, or (b) add App Bridge (and session token) to the backend-served pages (e.g. inject the script and use it for auth/nav).

### Uses theme extensions to add storefront functionality

- **Status: ✅** The app has a **theme extension** (`extensions/theme-extension`) with app blocks (e.g. Trust & Guarantee). That counts as using theme extensions for storefront functionality.
- The “reliably and completely uninstall” note: theme app blocks are managed by Shopify and are removed when the app is uninstalled. We also handle `app_uninstalled` and mark the shop + clean up data, so we don’t leave backend state behind.

---

## Summary

| Criterion | Status | Notes |
|-----------|--------|--------|
| Core Web Vitals (LCP, CLS, INP) | ⚠️ Pending | Needs 100+ calls + good metrics; CLS guidance assumes App Bridge. |
| Minimizes storefront impact | ✅ | Admin-only app; theme extension is standard. |
| App embedding enabled | ✅ | frame-ancestors set; app loads in iframe. |
| Session token authentication | ❌ | Uses stored OAuth token only. |
| App Bridge on every page | ❌ | Main app UI is backend HTML, no App Bridge. |
| Theme extensions | ✅ | Theme extension with app blocks. |

So the app is **not** fully aligned with the “embedded app” highlight (session token + App Bridge on every page). It can still be **listed and used**; the Distribution criteria affect **badges/highlights** and possibly **review priority**, not necessarily “can we go live.”

---

## What to do next

- **To get the embedded-app checkmarks:**  
  - Add **session token authentication** (App Bridge `getSessionToken()` → verify on backend).  
  - Use **App Bridge on every page** merchants see in the iframe: either make the App URL the admin (React) app and use App Bridge there everywhere, or add App Bridge (and session token) to the backend-served HTML.

- **Core Web Vitals:**  
  - After the above, ensure the embedded UI is lightweight and stable (avoid layout shifts). Once you have 100+ admin loads, Shopify will show pass/fail in Distribution.

- **Operational:**  
  - Set `NODE_ENV=production` (and any needed env vars) on Railway; run migrations; configure webhooks and billing as in your existing docs.
