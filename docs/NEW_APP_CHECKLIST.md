# New Shopify app – what to enter

Use this when creating the new app in the **Dev Dashboard** (https://dev.shopify.com/dashboard/) so billing works. Copy-paste the values below.

---

## 1. Create the app

- Go to **https://dev.shopify.com/dashboard/**
- Left sidebar: **Apps**
- Top right: **Create app**
- **App name:** `Conversion Optimizer` (or any name you like)
- Click **Create**
- When asked how to start: choose **Start from Dev Dashboard**

---

## 2. Create a version (required before install)

Open your new app → **Versions** tab → create a new version. Fill in:

| Field | Value to enter |
|--------|----------------|
| **App URL** | `https://conversion-optimizer-api-production.up.railway.app` |
| **Allowed redirection URL(s)** or **Redirect URLs** | `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback` |

- **Scopes** (or **Access scopes**):  
  `read_products`, `read_orders`, `read_themes`  
  (If it asks for a comma-separated list, use exactly: `read_products,read_orders,read_themes`)

- **Webhooks API version:** pick the latest (e.g. 2024-01 or newest offered).

Save / release the version.

---

## 3. Get credentials

- In the app: **Settings**
- Copy:
  - **Client ID** → you’ll set this as `SHOPIFY_API_KEY`
  - **Client secret** → you’ll set this as `SHOPIFY_API_SECRET`

---

## 4. Update your backend (Railway)

In your Railway **app service** → **Variables**, set:

| Variable | Value |
|----------|--------|
| **SHOPIFY_API_KEY** | (paste the new **Client ID** from the app Settings) |
| **SHOPIFY_API_SECRET** | (paste the new **Client secret** from the app Settings) |

Leave **SHOPIFY_APP_URL** as:

`https://conversion-optimizer-api-production.up.railway.app`

Redeploy the service after changing variables.

---

## 5. Install the app on your store

- In the Dev Dashboard, in your app: use **Install** (or the install flow).
- Select your store: `conversionoptimizer.myshopify.com`
- Complete the install (OAuth will run; you’ll approve the app).

---

## 6. Optional: webhooks

If the new app lets you register webhook subscriptions, use this base URL and add the topic at the end:

**Base URL:**  
`https://conversion-optimizer-api-production.up.railway.app/api/webhooks/shopify/`

**Example subscriptions:**

| Topic | Full URL |
|--------|----------|
| App uninstalled | `https://conversion-optimizer-api-production.up.railway.app/api/webhooks/shopify/app_uninstalled` |
| Subscription updates (billing) | `https://conversion-optimizer-api-production.up.railway.app/api/webhooks/shopify/app_subscriptions_update` |

(Your backend already handles these; add only if the Dev Dashboard has a webhook section.)

---

## Quick copy-paste summary

```
App URL:
https://conversion-optimizer-api-production.up.railway.app

Redirect URL:
https://conversion-optimizer-api-production.up.railway.app/api/auth/callback

Scopes:
read_products,read_orders,read_themes
```

After creating the app and version, put the new **Client ID** and **Client secret** into Railway as `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`, redeploy, then install the new app on your store. Subscribe/billing should then work.
