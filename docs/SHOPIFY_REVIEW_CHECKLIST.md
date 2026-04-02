# Shopify App Review — Pre-submission checklist

Use this before and during review so reviewers don’t hit configuration or compliance issues.

---

## 1. Partners / App setup (must match your live app)

In **Shopify Partners** → your app → **App setup**:

| Field | Value | Notes |
|-------|--------|------|
| **App URL** | `https://YOUR-RAILWAY-URL` (no trailing slash) | Must match `SHOPIFY_APP_URL` in Railway. Example: `https://conversion-optimizer-api-production.up.railway.app` |
| **Allowed redirection URL(s)** | `https://YOUR-RAILWAY-URL/api/auth/callback` | Exactly one; no trailing slash. Required for OAuth. |
| **App proxy** | Off (unless you use it) | This app does not use app proxy. |

Reviewers will open the app from the Shopify Admin. The first request will be `GET /?shop=store.myshopify.com`. The app either shows the app home (if installed) or redirects the top frame to OAuth, then back to the app.

---

## 2. Environment variables (Railway / backend)

All of these must be set on the backend service. Missing `SHOPIFY_APP_URL` or `SHOPIFY_API_KEY` will cause OAuth to return 503 with a clear message instead of redirecting to a broken URL.

| Variable | Required | Used for |
|----------|----------|----------|
| `SHOPIFY_APP_URL` | Yes | OAuth redirect URI, billing return URL, app home links. No trailing slash. |
| `SHOPIFY_API_KEY` | Yes | OAuth client_id, redirect to app after install. |
| `SHOPIFY_API_SECRET` | Yes | OAuth and webhook HMAC verification. |
| `DATABASE_URL` | Yes | Shops, recommendations, billing state. |
| `REDIS_URL` | Yes | Scan job queue (BullMQ). |
| `ENCRYPTION_KEY` | Yes | Encrypted access tokens. |
| `SHOPIFY_SCOPES` | Optional | Default: `read_products,read_orders,read_themes`. |
| `BILLING_TEST` | Optional | Set to `true` for test charges during development. |

---

## 3. Webhooks (Partners → App setup → Event subscriptions)

The app handles these. Register them in Partners so Shopify can send events:

| Subscription | Endpoint | Purpose |
|--------------|----------|---------|
| **App uninstalled** | `https://YOUR-RAILWAY-URL/api/webhooks/shopify/app_uninstalled` | Mark shop as uninstalled so next open forces OAuth. |
| **App subscriptions update** | `https://YOUR-RAILWAY-URL/api/webhooks/shopify/app_subscriptions_update` | Clear billing when a subscription is cancelled/expired. |
| **App subscriptions delete** | `https://YOUR-RAILWAY-URL/api/webhooks/shopify/app_subscriptions_delete` | Same as above. |

**Compliance webhooks (required for App Store):** Register these three. The app responds 200 and does not expose errors to Shopify.

| Topic | Endpoint |
|-------|----------|
| **Customers data request** | `https://YOUR-RAILWAY-URL/api/webhooks/shopify/customers/data_request` |
| **Customers redact** | `https://YOUR-RAILWAY-URL/api/webhooks/shopify/customers/redact` |
| **Shop redact** | `https://YOUR-RAILWAY-URL/api/webhooks/shopify/shop/redact` |

All webhooks use HMAC verification (`X-Shopify-Hmac-Sha256`). Invalid HMAC returns `401`. Unregistered topics are ignored.

---

## 4. Scopes (Partners → Configuration → Client credentials → Access scopes)

The app requests:

- **read_products** — To run the store scan (products, images, variants) and generate recommendations.
- **read_orders** — Listed in default scopes; can be removed if you do not use orders in the future.
- **read_themes** — To evaluate theme/block presence for recommendations (e.g. trust blocks).

Only request scopes you need. Justification for review: “We use product and theme data to analyze the store and generate conversion recommendations.”

---

## 5. Billing (Partners + app behavior)

- **Plans:** Three plans (Starter $9, Growth $19, Pro $29) per month. Created via GraphQL `appSubscriptionCreate`.
- **Return URL:** After the merchant approves, Shopify redirects to  
  `https://YOUR-RAILWAY-URL/api/billing/return?shop=...&charge_id=...&plan=...`  
  The app confirms the subscription and stores the plan.
- **Test mode:** Set `BILLING_TEST=true` in Railway if you want test charges during review; otherwise reviewers will see real charge confirmation.
- **Clear pricing:** App home shows all three plans and prices before subscribe. No hidden fees.

---

## 6. Privacy policy and refund policy (Partners → App setup → Policies)

Shopify requires:

- **Privacy policy URL** — Live URL to your privacy policy.
- **Refund policy URL** — Live URL to your refund/cancellation policy.

The app serves these at:

- **Privacy:** `https://YOUR-RAILWAY-URL/privacy`
- **Refund:** `https://YOUR-RAILWAY-URL/refund`

Use these exact URLs in Partners (replace `YOUR-RAILWAY-URL` with your real app URL, no trailing slash). Add them in **App setup → Policies** before submitting for review.

---

## 7. App listing (Partners → App setup → Listing)

- **App name**, **tagline**, **description**, **pricing** — Use (or adapt) the copy in `docs/APP_STORE_LISTING.md`.
- **Screenshots** — At least one showing the in-app UI (e.g. app home with plans, or recommendations page). Avoid placeholder or stock images.
- **Support link** — Email or help URL. Optional but recommended.

---

## 8. What reviewers will do (and what should work)

1. **Install the app** — From the listing or a development store. OAuth runs; they land in the app home.
2. **See app home** — Logo, shop badge, short description, Plans card (Starter / Growth / Pro), Billing status link. If not subscribed, “Run scan” and “View recommendations” are gated (message to subscribe).
3. **Subscribe** — Click Subscribe on a plan → Shopify confirmation → return to app. Billing card shows “Your plan: …”.
4. **Run scan** — Open “Run scan” → “What we analyze” and “Start scan” → scan queued → link to View recommendations.
5. **View recommendations** — List with summary, filters, cards, Export CSV. No raw JSON or errors.
6. **Uninstall** — Uninstalling triggers `app_uninstalled` webhook; next open forces OAuth again.

Ensure there are no 500 errors, no “refused to connect” in the iframe (CSP `frame-ancestors` is set per request), and no broken links (e.g. wrong App URL in Partners).

---

## 9. Common rejection reasons (and how this app addresses them)

| Reason | How we address it |
|--------|--------------------|
| App doesn’t load / white screen | CSP allows shop domain and admin.shopify.com. Root returns HTML or redirects to OAuth. Missing config returns 503 with a message. |
| OAuth or redirect broken | Redirect URI is exactly `SHOPIFY_APP_URL + /api/auth/callback`. No trailing slash. Validated before redirect. |
| Billing unclear or broken | Three plans with clear prices; GraphQL billing; return URL confirms and stores plan. |
| Missing privacy/refund policy | You must add URLs in Partners; the app does not host them. |
| Webhooks not registered | Register app_uninstalled and app_subscriptions_* in Partners. |
| Compliance webhooks missing | Register customers/data_request, customers/redact, shop/redact; app returns 200 and 401 for invalid HMAC. |
| Too many or unjustified scopes | We use read_products, read_themes; read_orders is optional and can be removed. |
| Crashes or 500 with stack trace | Set NODE_ENV=production on Railway. The app uses a global exception filter so production responses never include stack traces. |

---

## 10. Configuration (App Store review page)

Before submitting, complete in the **App Store review** flow: **Emergency contact** (email + phone), **App icon** (1200×1200 px, JPEG or PNG), **API contact email** (must not contain "Shopify" or "Example"), and **App URL/domain** (no "Shopify" or "Example").

## 11. Match Distribution → Review requirements (Partners UI)

In **Distribution → App Store**, the checklist aligns with the sections below. Use this to confirm everything is correct for review.

| Section in Partners | How Conversion Optimizer meets it |
|---------------------|-----------------------------------|
| **Functionality** | OAuth immediately after install; redirect to app UI; OAuth after reinstall. No critical/minor errors (global exception filter). UI merchants can interact with (app home, scan, recommendations, billing). Web-based; single-merchant; Shopify APIs only. Functional test: install on dev store, subscribe, run scan, view recommendations. |
| **App Store listing** | Test credentials: reviewers use their dev store (OAuth). Demo screencast: provide in submission (onboarding + subscribe + scan + recommendations). Online Store: indicate if required (we're admin-only; no theme extensions). Pricing: accurate in app and in listing only; no pricing in images. App icon 1200×1200; accurate tags; effective subtitle; app name similar; no reviews/stats in listing; no Shopify brand misuse; app details per guidelines; geographic/language claims accurate. |
| **Embedded** | Consistent embedded experience (App Bridge, CSP frame-ancestors). Latest App Bridge script in `<head>`. No Max modal without interaction (we don't use admin extensions). |
| **Online store** | N/A — app does not modify the storefront or use theme app extensions. If Partners shows this section, ensure "Merchant must have online store" is set only if your listing says so. |

## 12. Performance (app speed)

The app is tuned so it feels responsive for review and production:

- **Compression:** Gzip for all responses (large HTML/JSON).
- **Static assets:** Logo and favicon cached 1 day.
- **App home:** Logo preloaded so it paints faster.
- **Recommendations API:** Slim query (only needed columns; no `patch_payload`), indexed by `shop_id` + `created_at`.
- **DB:** Connection pool (max 20, timeouts set); no redundant lookups on the app-home path.
- **Loading overlay:** App Bridge loading bar is dismissed when the page is ready so the app doesn't appear stuck.

## 13. Quick verification before submit

- [ ] App URL and Redirect URL in Partners match `SHOPIFY_APP_URL` (no trailing slash).
- [ ] All required env vars set in Railway (or your host).
- [ ] Event webhooks registered (app_uninstalled, app_subscriptions_*).
- [ ] **Compliance webhooks** registered (customers/data_request, customers/redact, shop/redact).
- [ ] Privacy policy and refund policy URLs set in Partners.
- [ ] Emergency contact and app icon (1200×1200) set; API contact email and URLs free of "Shopify"/"Example".
- [ ] Install app on a development store: open from Admin, complete OAuth, see app home.
- [ ] Subscribe to a plan, run a scan, open recommendations, export CSV.
- [ ] Uninstall and reinstall: OAuth runs again, app works.
- [ ] No console errors or “refused to connect” when loaded in Admin iframe.
