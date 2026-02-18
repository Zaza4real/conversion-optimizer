# Full audit: fix 422 "application is currently owned by a Shop"

Do every step and **verify** before moving on. The 422 means the **access token** your backend sends to Shopify is for a **store-owned** app. The only fix is to ensure the token is for your **Dev Dashboard** app.

---

## Step 1: Confirm which app can create charges

- You must use the app from **https://dev.shopify.com/dashboard** (Dev Dashboard).
- **Not** an app created from the store (e.g. Settings → Apps → “Develop apps” / custom app).
- In Dev Dashboard → **Apps** → open **Conversion Optimizer** → **Settings**.
- Note:
  - **Client ID:** `f1b31cf1dd10ef4c87caf06fcb065c81`
  - **Secret:** (the one that starts with `shpss_`)

---

## Step 2: Verify what your LIVE backend is using

After you **push and deploy** the latest code (with the `?debug=1` check), open in your browser:

```
https://conversion-optimizer-api-production.up.railway.app/?shop=conversionoptimizer.myshopify.com&debug=1
```

You should see JSON with **clientIdPreview** and **match: true/false**.

- **If match is true:** Railway is using the correct app. Go to Step 4 (clear shop and re-auth).
- **If match is false or clientIdPreview is different:** Railway has the **wrong** SHOPIFY_API_KEY. Fix it:
  - Railway → **conversion-optimizer-api** → **Variables**
  - Set **SHOPIFY_API_KEY** = `f1b31cf1dd10ef4c87caf06fcb065c81` (exact, no spaces)
  - Set **SHOPIFY_API_SECRET** = the Secret from Dev Dashboard (starts with `shpss_`)
  - Save, wait for **full redeploy**, then open the debug URL again until **match: true**.

---

## Step 3: Dev Dashboard app configuration

In Dev Dashboard → your app → **Versions** (active version):

- **App URL:** `https://conversion-optimizer-api-production.up.railway.app`
- **Redirect URLs:** must include exactly  
  `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback`
- **Scopes:** include `read_products`, `read_orders`, `read_themes`

If you change anything, save/release the version.

---

## Step 4: Clear the shop and get a new token

The token in your DB was created with the **old** app. You must remove it and run OAuth again **after** Railway has the correct key (Step 2).

Run (use your **Postgres public URL** from Railway, not the app URL):

```bash
psql "YOUR_POSTGRES_PUBLIC_URL" -c "DELETE FROM shops WHERE domain = 'conversionoptimizer.myshopify.com';"
```

You should see `DELETE 1`.

---

## Step 5: Only the Dev Dashboard app on the store

- **Shopify Admin** → **Settings** → **Apps**
- **Uninstall every** “Conversion Optimizer” or custom app you see.
- In **Dev Dashboard** → your app → **Install** → choose **conversionoptimizer.myshopify.com** → complete install.

So the store has **only one** app, and it’s the one from Dev Dashboard.

---

## Step 6: Open the app and run OAuth

- **Shopify Admin** → **Apps** → click **Conversion Optimizer** (the one you just installed).
- You should be sent to Shopify to **approve** the app. Approve it.
- You should land back in the app. The backend will have saved a **new** token for the Dev Dashboard app.

---

## Step 7: Try Subscribe again

- In the app, click **Subscribe for $19/month**.

If you still get 422:

1. Open the **debug** URL again (Step 2). If **match** is false, Railway is still not using the right key — fix Variables again and redeploy.
2. Make sure you did Step 4 **after** fixing Railway (Step 2). The order is: fix Railway → redeploy → delete shop → open app (Step 6) → Subscribe.

---

## Checklist summary

| # | What | Done? |
|---|------|--------|
| 1 | Dev Dashboard app has Client ID `f1b31cf1dd10ef4c87caf06fcb065c81` | |
| 2 | Debug URL shows `match: true` (after deploy) | |
| 3 | Dev Dashboard app has correct App URL and Redirect URL | |
| 4 | `DELETE FROM shops` run **after** Railway has correct key | |
| 5 | Store has only the Dev Dashboard app installed | |
| 6 | Opened app from Shopify Admin and approved | |
| 7 | Clicked Subscribe | |

The **critical** step is Step 2: the live backend must show **match: true**. If it doesn’t, the token will always be for the wrong app and you’ll keep getting 422.
