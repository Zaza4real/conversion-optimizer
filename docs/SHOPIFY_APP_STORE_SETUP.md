# Conversion Optimizer — Shopify App Store setup

**This is the main guide** to get the app live and ready for Shopify App Store review. Do these steps once; use the verification section to confirm everything works.

Replace `YOUR_APP_URL` everywhere with your real backend URL (e.g. `https://conversion-optimizer-api-production.up.railway.app`). **No trailing slash.**

---

## 1. Backend (Railway or other host)

- **Root directory:** `apps/backend` (so `package.json`, `railway.toml`, and `public/` are used).
- **Build:** `npm install && npm run build`
- **Start:** `npm run start`
- **Migrations:** Run `npm run migration:run` after deploy (or in a release step) so the DB has the latest schema (including plan tiers).

### Environment variables (all required except where noted)

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_APP_URL` | Yes | Your app’s public URL. No trailing slash. Must match Partners. |
| `SHOPIFY_API_KEY` | Yes | Partners → App → Client ID |
| `SHOPIFY_API_SECRET` | Yes | Partners → App → Client secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string (from Railway Postgres or your DB) |
| `REDIS_URL` | Yes | Redis connection string (from Railway Redis or your Redis) |
| `ENCRYPTION_KEY` | Yes | e.g. `openssl rand -hex 32` — used to encrypt access tokens |
| `SHOPIFY_SCOPES` | No | Default: `read_products,read_orders,read_themes` |
| `BILLING_TEST` | No | Set to `true` for test billing during development |
| `NODE_ENV` | No | Set to `production` in production |
| `APP_STORE_LISTING_URL` | No | Your app’s public listing URL (e.g. `https://apps.shopify.com/your-app-handle`). When set, the app footer shows “Leave a review” to encourage ratings. |

---

## 2. Shopify Partners (App setup)

In **Partners** → your app → **App setup**:

| Field | Value |
|-------|--------|
| **App URL** | `YOUR_APP_URL` |
| **Allowed redirection URL(s)** | `YOUR_APP_URL/api/auth/callback` |
| **App proxy** | Off |

**Required for App Store:** Do not use the words "Shopify" or "Example" in your app URL, domain, or API/contact email (no misspellings or abbreviations). Use a valid TLS/SSL URL (HTTPS).

### Configuration setup (App Store review page)

Before submitting, complete on the **App Store review** flow in Partners:

- **Emergency contact** — Email and phone so Shopify can reach you for critical issues.
- **App icon** — 1200×1200 px, JPEG or PNG. Bold colors, simple shape; avoid text and Shopify trademarks. [Templates](https://shopify.dev/zip/SubmissionTemplates.zip).
- **API contact email** — Must not contain "Shopify" (or misspellings/abbreviations).

### Event subscriptions (webhooks)

Add these **Event subscriptions** (exact paths):

| Event | Subscription URL |
|-------|-------------------|
| App uninstalled | `YOUR_APP_URL/api/webhooks/shopify/app_uninstalled` |
| App subscriptions update | `YOUR_APP_URL/api/webhooks/shopify/app_subscriptions_update` |
| App subscriptions delete | `YOUR_APP_URL/api/webhooks/shopify/app_subscriptions_delete` |

### Compliance webhooks (required for App Store)

Apps distributed through the Shopify App Store **must** subscribe to these. Register each URL in Partners (Event subscriptions or app config):

| Topic | Subscription URL |
|-------|-------------------|
| Customers data request | `YOUR_APP_URL/api/webhooks/shopify/customers/data_request` |
| Customers redact | `YOUR_APP_URL/api/webhooks/shopify/customers/redact` |
| Shop redact | `YOUR_APP_URL/api/webhooks/shopify/shop/redact` |

The app responds with `200` to acknowledge receipt; invalid HMAC returns `401`. It does not store customer PII; for `shop/redact` it deletes all data for that shop.

### Policies (required for review)

The app serves policy pages. Use these URLs in **App setup → Policies**:

| Policy | URL |
|--------|-----|
| Privacy policy | `YOUR_APP_URL/privacy` |
| Refund policy | `YOUR_APP_URL/refund` |

---

## 3. Verification (do this before submitting for review)

1. **Health**  
   Open `YOUR_APP_URL/health` in a browser. You should see: `{"status":"ok","app":"Conversion Optimizer"}`.

2. **Install**  
   Open the app from a development store (Apps → Conversion Optimizer, or install from your listing). You should see the app home (logo, shop name, Plans or Billing, Run scan / View recommendations).

3. **Subscribe**  
   Click Subscribe on a plan → approve on Shopify → you are redirected back to the app. The Billing card should show “Your plan: …”.

4. **Run scan**  
   Click Run scan → Start scan → “Scan queued” and a link to View recommendations.

5. **Recommendations**  
   Open View recommendations. You should see a list (or “No recommendations yet” if the scan just started). Use filters and Export CSV.

6. **Policies**  
   Open `YOUR_APP_URL/privacy` and `YOUR_APP_URL/refund`. Both should load with clear policy text.

7. **Uninstall**  
   Uninstall the app from the store, then open it again. You should be asked to re-authorize (OAuth), then see the app home again after reinstall.

---

## 4. Before you submit for review

- [ ] All env vars set; health check returns `status: ok`.
- [ ] Partners App URL and Redirect URL match `SHOPIFY_APP_URL` (no trailing slash).
- [ ] Event webhooks registered (app_uninstalled, app_subscriptions_update, app_subscriptions_delete).
- [ ] **Compliance webhooks** registered (customers/data_request, customers/redact, shop/redact).
- [ ] Privacy and refund policy URLs set in Partners (using `/privacy` and `/refund`).
- [ ] Emergency contact and app icon (1200×1200) set on App Store review page; API contact email does not contain "Shopify" or "Example".
- [ ] You have run through install → subscribe → scan → recommendations on a dev store.
- [ ] Listing copy and screenshots ready (see **App listing** below).

### App listing

- **Copy and pricing:** Use [APP_STORE_LISTING.md](./APP_STORE_LISTING.md) for tagline, description, features, and pricing table.
- **Detailed review checklist:** Use [SHOPIFY_REVIEW_CHECKLIST.md](./SHOPIFY_REVIEW_CHECKLIST.md) for scopes, billing, and common rejection reasons.

---

## 5. Quick reference — URLs the app uses

| Purpose | URL |
|--------|-----|
| App (home) | `YOUR_APP_URL/?shop=store.myshopify.com` |
| OAuth start | `YOUR_APP_URL/api/auth?shop=store.myshopify.com` |
| OAuth callback | `YOUR_APP_URL/api/auth/callback` |
| Billing status | `YOUR_APP_URL/api/billing/status?shop=...` |
| Subscribe | `YOUR_APP_URL/api/billing/subscribe?shop=...&plan=starter\|growth\|pro` |
| Billing return | `YOUR_APP_URL/api/billing/return` (Shopify redirects here) |
| Run scan page | `YOUR_APP_URL/scan/run?shop=...` |
| Recommendations page | `YOUR_APP_URL/recommendations?shop=...` |
| Privacy | `YOUR_APP_URL/privacy` |
| Refund | `YOUR_APP_URL/refund` |
| Health | `YOUR_APP_URL/health` |
| Compliance webhooks | `.../api/webhooks/shopify/customers/data_request`, `.../customers/redact`, `.../shop/redact` |

If something fails, check [SHOPIFY_REVIEW_CHECKLIST.md](./SHOPIFY_REVIEW_CHECKLIST.md) and [RAILWAY_VERIFICATION_CHECKLIST.md](./RAILWAY_VERIFICATION_CHECKLIST.md) for troubleshooting.
