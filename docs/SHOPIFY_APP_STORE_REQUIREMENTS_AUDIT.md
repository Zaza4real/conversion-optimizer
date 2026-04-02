# Shopify App Store requirements — audit for Conversion Optimizer

This document maps **official Shopify App Store requirements** ([App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)) to this app. Use it to confirm the app has everything needed for review.

**Legend**
- **In app** — Implemented in code; no action needed (unless you change behavior).
- **In Partners** — You must configure in Shopify Partners (App setup, Distribution, App Store review form).
- **N/A** — Category-specific; does not apply to this app (e.g. Payment, Sales channel).

---

## 1. Policy

| Requirement | Status | Notes |
|-------------|--------|--------|
| 1.1.1 Use session tokens for authentication; no third-party cookies/local storage; works in incognito | **In app** | App uses server-side OAuth token (encrypted). UI is server-rendered; no client-side auth that relies on third-party cookies. App Bridge script loaded for embedded experience. |
| 1.1.2 Use Shopify checkout | **N/A** | App does not run checkout; it’s an admin/analytics app. |
| 1.1.3–1.1.16 (themes, factual info, unique app, etc.) | **In app** | No theme download, no fake data, no marketplace/lending/refund processing. |
| **1.2 Bill through Shopify Billing API or Managed Pricing** | **In app** | All charges via GraphQL `appSubscriptionCreate`. No off-platform billing. |
| 1.2.1–1.2.2 Use and implement Billing API correctly | **In app** | Recurring subscriptions; confirm and store plan on return; test mode via `BILLING_TEST`. |
| 1.2.3 Allow pricing plan changes (upgrade/downgrade without support/reinstall) | **In app** | Plan change via new subscription (replacementBehavior: APPLY_IMMEDIATELY). In-app cancel via cancel-confirm + API. |

---

## 2. Functionality

| Requirement | Status | Notes |
|-------------|--------|--------|
| 2.1.1–2.1.3 No critical/minor errors; operational UI | **In app** | Global exception filter hides stack traces in production. App home, scan, recommendations, billing flows are UI-driven. |
| 2.1.4 Synchronize data accurately | **In app** | Scan reads products/themes via API; recommendations stored per shop. |
| 2.2.1 Use Shopify APIs | **In app** | Admin API (GraphQL + REST where used) for products, shop, billing, webhooks. |
| 2.2.2 Consistent embedded experience | **In app** | App loads in Admin iframe; CSP `frame-ancestors` set; App Bridge script in `<head>`. |
| 2.2.3 Use latest Shopify App Bridge | **In app** | `<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>` first in head (see `getAppBridgeHead()`). |
| 2.2.4 Use GraphQL Admin API | **In app** | Billing uses GraphQL (appSubscriptionCreate, appSubscriptionCancel, currentAppInstallation). |
| 2.2.5–2.2.7 Admin extensions / no promotions / max modal | **N/A** | No admin UI extensions; no modal launch without interaction. |
| **2.3 Seamless and secure installation** | **In app** | |
| 2.3.1 Install only from Shopify-owned surface | **In app** | No manual myshopify.com entry during install; install from App Store or Partners. |
| 2.3.2 Authenticate immediately after install | **In app** | Root `GET /?shop=...` redirects to OAuth if shop not installed; no UI before OAuth. |
| 2.3.3 Redirect to app UI after install | **In app** | OAuth callback redirects to app home. |
| 2.3.4 Require OAuth immediately after reinstall | **In app** | `app_uninstalled` webhook marks shop; next open forces OAuth again. |

---

## 3. Security

| Requirement | Status | Notes |
|-------------|--------|--------|
| 3.1.1 Valid TLS/SSL (HTTPS) | **In Partners / Host** | App must be served over HTTPS (e.g. Railway). No TLS logic in app code. |
| 3.2 Request only necessary access scopes | **In app** | Default: `read_products`, `read_orders`, `read_themes`. Justification: product/theme data for scan and recommendations. |

---

## 4. App Store listing

| Requirement | Status | Notes |
|-------------|--------|--------|
| 4.1.1 App name similar (Dashboard vs listing) | **In Partners** | Set same name in Partners and in app listing. |
| 4.1.2 App icon 1200×1200 (JPEG/PNG) | **In Partners** | Upload in App setup / App Store review; no “Shopify” in icon. |
| 4.2.1–4.2.3 Pricing accurate and only in designated areas | **In app** | Plans and prices in app home and listing; no pricing in images/logo. |
| 4.3.x Accurate listing (sales channel, languages, no fake stats, tags, etc.) | **In Partners** | Use `docs/APP_STORE_LISTING.md`; no stats/guarantees in copy or images. |
| 4.4.x Clear assets and descriptions; no misuse of Shopify brand | **In Partners** | Screenshots, subtitle, app details per checklist; no Shopify logos in graphics. |
| **4.5 Ensure submission is complete and accurate** | **In Partners** | |
| 4.5.3 Demo screencast (onboarding + features, English or subtitles) | **In Partners** | Provide in App Store review. |
| 4.5.4–4.5.5 Test credentials (valid, full access) | **In Partners** | If app needs login, provide in testing instructions. This app uses OAuth; reviewers use their dev store. |
| 4.5.6 Emergency developer contact | **In Partners** | Email + phone in Partner account settings. |

---

## 5. Category-specific

This app is **not** a Payment, Sales channel, Post-purchase, Online store (theme-modifying), or other special category. It is an **embedded admin app** that:

- Runs in Shopify Admin iframe.
- Uses Billing API for subscriptions.
- Does not modify the storefront (no theme app extensions).
- Does not process payments or checkout.

So **5.1 (Online store)**, **5.2 (Payment)**, **5.3–5.11** are **N/A** except:

- **Embedded:** App uses App Bridge, loads in iframe, CSP set. No storefront performance impact (app is admin-only).

---

## Mandatory compliance webhooks (required for App Store)

| Webhook | Status | Notes |
|---------|--------|--------|
| **customers/data_request** | **In app** | Handled in `WebhooksService`; responds 200; HMAC verified; 401 if invalid. |
| **customers/redact** | **In app** | Same; app does not store per-customer PII. |
| **shop/redact** | **In app** | Deletes shop data (GDPR) 48h after uninstall. |

**In Partners:** You must **subscribe** these webhooks to your app’s endpoint (e.g. `https://YOUR-RAILWAY-URL/api/webhooks/shopify/customers/data_request`, etc.). Use Partners → App setup → Event subscriptions, or CLI deploy with compliance topics. See `SHOPIFY_REVIEW_CHECKLIST.md` and `RUN_COMPLIANCE_WEBHOOKS_CLI.md` (if present).

---

## Submission configuration (Partners / App Store review form)

These are **required** and are **not** in code; you set them in Partners:

| Item | Where | Requirement |
|------|--------|-------------|
| App URL | App setup | `https://YOUR-RAILWAY-URL` (no trailing slash); must match `SHOPIFY_APP_URL`. |
| Allowed redirection URL(s) | App setup | `https://YOUR-RAILWAY-URL/api/auth/callback` (exactly). |
| Privacy policy URL | App setup → Policies | `https://YOUR-RAILWAY-URL/privacy` |
| Refund policy URL | App setup → Policies | `https://YOUR-RAILWAY-URL/refund` |
| Event webhooks | App setup → Event subscriptions | `app_uninstalled`, `app_subscriptions_update`, `app_subscriptions_delete` → `https://YOUR-RAILWAY-URL/api/webhooks/shopify/...` |
| Compliance webhooks | App setup / CLI | `customers/data_request`, `customers/redact`, `shop/redact` → same base URL. |
| Emergency contact | Partner account / App Store review | Email + phone. |
| App icon 1200×1200 | App Store review / App setup | JPEG or PNG. |
| API contact email | App Store review | Must not contain “Shopify” or “Example”. |
| App URL/domain in form | App Store review | Must not contain “Shopify” or “Example”. |
| Demo screencast | App Store review | Onboarding + features; English or subtitles. |
| Test instructions | App Store review | How to install, subscribe, run scan, view recommendations. |

---

## Summary: does the app have every requirement?

- **Code / backend:** Yes. The app implements:
  - OAuth-first install and reinstall
  - Shopify Billing API (GraphQL) with plan change and in-app cancel
  - App Bridge (latest), embedded iframe, CSP
  - Mandatory compliance webhooks (customers/data_request, customers/redact, shop/redact) with HMAC and 200/401
  - Privacy and refund pages at `/privacy` and `/refund`
  - Necessary scopes only; no stack traces in production responses

- **Partners / submission form:** You must complete:
  - App URL and redirect URL
  - Privacy and refund policy URLs (pointing to your app)
  - Event + compliance webhook subscriptions
  - Emergency contact, app icon 1200×1200, API contact email (no “Shopify”/“Example”)
  - Demo screencast and testing instructions

**Conclusion:** The app meets all **in-code** Shopify App Store requirements. The remaining items are **configuration and listing** in Partners and the App Store review form. Use `SHOPIFY_REVIEW_CHECKLIST.md` and `PREPARE_FOR_REVIEW.md` for step-by-step checks before submit.
