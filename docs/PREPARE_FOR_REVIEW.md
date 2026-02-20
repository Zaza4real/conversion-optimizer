# Prepare for review — Conversion Optimizer

Use this **right before and during** App Store review. Full criteria are in **SHOPIFY_REVIEW_CHECKLIST.md**.

---

## What’s been optimized

- **Build:** Backend and admin build successfully (`pnpm run build`).
- **Routes:** `/landing` is correctly excluded from the `/api` prefix so the marketing landing page loads.
- **Response speed:** Gzip compression is enabled. A global exception filter is enabled so production never sends stack traces in JSON (required for App Store review and security).
- **Billing:** Test mode works with `BILLING_TEST=true`; plan upgrades use `replacementBehavior: APPLY_IMMEDIATELY`. Clear error messages when plan change fails and the merchant already has a plan.
- **Policies:** `/privacy`, `/refund`, `/support`, `/health` are served and linked from the app.

---

## Run these checks (before reviewers test)

Replace `YOUR-RAILWAY-URL` with your real backend URL (e.g. `conversion-optimizer-api-production.up.railway.app`).

### 1. Health and policies (public, no auth)

| Check | URL | Expected |
|-------|-----|----------|
| Health | `https://YOUR-RAILWAY-URL/health` | `{"status":"ok","app":"Conversion Optimizer"}` |
| Privacy | `https://YOUR-RAILWAY-URL/privacy` | HTML privacy policy page |
| Refund | `https://YOUR-RAILWAY-URL/refund` | HTML refund/cancellation page |
| Support | `https://YOUR-RAILWAY-URL/support` | HTML support page |

### 2. Partners configuration

- **App setup → App URL:** `https://YOUR-RAILWAY-URL` (no trailing slash).
- **App setup → Allowed redirection URL(s):** `https://YOUR-RAILWAY-URL/api/auth/callback`
- **App setup → Policies:** Privacy URL = `https://YOUR-RAILWAY-URL/privacy`, Refund URL = `https://YOUR-RAILWAY-URL/refund`
- **Event subscriptions:** `app_uninstalled`, `app_subscriptions_update`, `app_subscriptions_delete` pointing to `https://YOUR-RAILWAY-URL/api/webhooks/shopify/...`
- **Compliance webhooks:** `customers/data_request`, `customers/redact`, `shop/redact` (via CLI deploy or manually; see **RUN_COMPLIANCE_WEBHOOKS_CLI.md**)

### 3. Railway variables

- Required: `SHOPIFY_APP_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`
- **For review:** Set `BILLING_TEST=true` so reviewers can approve a **test** subscription on their development store without a real charge. Set to `false` after approval when you have real merchants.
- **Production:** Set `NODE_ENV=production` so stack traces are never sent to clients.

### 4. Full flow on a development store

1. Install the app from Partners (or the listing) on a dev store.
2. Open the app from Shopify Admin → Apps. OAuth should complete and you should see the app home (logo, plans, Run scan, View recommendations).
3. Click **Subscribe** on Growth or Pro → approve on Shopify’s page (with `BILLING_TEST=true` you’ll see the test billing banner).
4. Back in the app: **Run scan** → wait for completion → **View recommendations** → use filters, **Export CSV**.
5. Uninstall the app, then open it again from Admin. OAuth should run again and the app should load.

If anything fails, use **FIX_BILLING_SUBSCRIPTION_FAILED.md** and **SHOPIFY_REVIEW_CHECKLIST.md** for troubleshooting.

---

## Submission checklist (App Store review page)

- [ ] Emergency contact (email + phone) set.
- [ ] App icon 1200×1200 px (JPEG or PNG) uploaded.
- [ ] API contact email set and does **not** contain “Shopify” or “Example”.
- [ ] App URL/domain does **not** contain “Shopify” or “Example”.
- [ ] All items in **SHOPIFY_REVIEW_CHECKLIST.md** section 11 are done.

---

## Reference

- **SHOPIFY_REVIEW_CHECKLIST.md** — Full pre-submission checklist and reviewer expectations.
- **FIX_BILLING_SUBSCRIPTION_FAILED.md** — Billing and “shop cannot accept the charge” fixes.
- **RUN_COMPLIANCE_WEBHOOKS_CLI.md** — Deploy compliance webhooks with Shopify CLI.
