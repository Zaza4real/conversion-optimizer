# Railway Variables – reference

Set these on **conversion-optimizer-api** → **Variables**. Match your Dev Dashboard app and local `.env` for Shopify keys.

## Required

| Variable | Value / source |
|----------|----------------|
| **DATABASE_URL** | From Postgres service (Reference or copy). Prefer internal URL for app. |
| **REDIS_URL** | From Redis service (Reference or copy; sometimes named REDIS_PRIVATE_URL). |
| **ENCRYPTION_KEY** | Any 32+ char secret (e.g. `openssl rand -hex 32`). |
| **SHOPIFY_API_KEY** | Client ID from Dev Dashboard → your app → Settings. |
| **SHOPIFY_API_SECRET** | Client secret from Dev Dashboard → your app → Settings. |
| **SHOPIFY_APP_URL** | `https://conversion-optimizer-api-production.up.railway.app` (no trailing slash). |

## Optional

| Variable | Value |
|----------|--------|
| **SHOPIFY_SCOPES** | e.g. `read_products,read_orders,read_themes` (app has default). |
| **NODE_ENV** | `production` recommended. |
| **BILLING_TEST** | `true` for test charges only. |
| **APP_STORE_LISTING_URL** | Your app’s public listing URL (e.g. `https://apps.shopify.com/conversion-optimizer`). |
| **SUPPORT_EMAIL** | Email shown on the **Support** page (`/support`) so merchants can contact you. Pro plan is promoted as 24/7 support. |
| **NEWSLETTER_NOTIFY_EMAIL** | Email to receive a notification when someone signs up via the store landing form. Also set **SMTP_HOST**, **SMTP_USER**, **SMTP_PASS** (see [NEWSLETTER_EMAIL_SETUP.md](./NEWSLETTER_EMAIL_SETUP.md)). |

After changing Variables, save and let Railway redeploy. If you changed Shopify keys, clear the shop (forget URL or `DELETE FROM shops`) and open the app from Shopify Admin so a new token is saved.
