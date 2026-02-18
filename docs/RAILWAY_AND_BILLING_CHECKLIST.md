# Railway + Billing – Your project checklist

Use **your exact Railway URL**:  
**`https://conversion-optimizer-api-production.up.railway.app`**

---

## 1. Deploy pending changes in Railway

Your screenshot showed **“Apply 2 changes”** / **“2 Changes”** on the `conversion-optimizer-api` service.

- In Railway, open **conversion-optimizer-api**.
- Apply the changes and trigger a **Deploy** (or push from git so Railway deploys).
- Wait until the deployment is **successful** and the service is **Running**.  
  This is needed so `/api/auth/forget` and `/api/auth/debug` are available.

---

## 2. Set Variables on the Railway service

- Click **conversion-optimizer-api**.
- Open the **Variables** tab (not Settings).
- Ensure these exist with **exact** values:

| Variable name         | Value |
|-----------------------|--------|
| **SHOPIFY_APP_URL**   | `https://conversion-optimizer-api-production.up.railway.app` (no trailing slash) |
| **SHOPIFY_API_KEY**   | **Client ID** from Dev Dashboard (see step 3) |
| **SHOPIFY_API_SECRET**| **Client secret** from Dev Dashboard (see step 3) |

- Add any other variables your app needs (e.g. `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `SHOPIFY_SCOPES`).
- Save. Let Railway **redeploy** after variable changes.

---

## 3. Get credentials from Dev Dashboard (not from the store)

- Go to **https://dev.shopify.com/dashboard**
- Left sidebar: **Apps** → open your app (the one you created with **Start from Dev Dashboard**).
- Left sidebar: **Settings**.
- Copy **Client ID** and **Client secret**.
- In Railway **Variables**, set **SHOPIFY_API_KEY** = Client ID and **SHOPIFY_API_SECRET** = Client secret, then save and redeploy.

---

## 4. Dev Dashboard app configuration

In the same app in Dev Dashboard:

- **Versions** → open the active version (or create one).
- **App URL:** `https://conversion-optimizer-api-production.up.railway.app`
- **Redirect URLs:** add exactly  
  `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback`
- **Scopes:** `read_products`, `read_orders`, `read_themes`
- Save/Release the version.

---

## 5. Check what the backend is using (after deploy)

Open in the browser (use your store domain if different):

```
https://conversion-optimizer-api-production.up.railway.app/api/auth/debug?shop=conversionoptimizer.myshopify.com
```

You should see JSON with:

- **railwayUrl** – should be `https://conversion-optimizer-api-production.up.railway.app`
- **clientIdPreview** – first and last 4 characters of the app’s Client ID. Compare with Dev Dashboard → your app → **Settings** → **Client ID** (must match).
- **shopStatus** – `shop exists` or `no shop`
- **tokenValid** – `true` or `false`
- **canBill** – `true` only if shop exists and token is valid.
- **nextStep** – tells you what to do next.

If **clientIdPreview** does not match the Dev Dashboard app’s Client ID, fix **SHOPIFY_API_KEY** in Railway (step 2) and redeploy, then check again.

If **tokenValid** is `false`, do step 6.

---

## 6. Clear the stored shop and re-auth (if token invalid or 422)

**Option A – Forget URL** (requires deployed code with `/api/auth/forget`)

Open in the browser:

```
https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com
```

(This deletes the shop in your DB and redirects to OAuth.)

- Approve the app when Shopify asks.
- You should land back in the app; the backend will save a **new** token.

**Option B – Run SQL from your laptop** (use this if the forget URL returns 404)

1. Get the Postgres **public** URL from Railway: Postgres service → **Variables** or **Connect**. The host must be like `maglev.proxy.rlwy.net` or `*.railway.app` — **not** `postgres.railway.internal` (that only works from inside Railway). Do **not** commit this URL.
2. In terminal:  
   `psql "YOUR_PUBLIC_DATABASE_URL" -c "DELETE FROM shops WHERE domain = 'conversionoptimizer.myshopify.com';"`
3. Then in **Shopify Admin** → **Apps** → open **Conversion Optimizer** and go through the install/approve flow again.

---

## 7. Only one app on the store

- **Shopify Admin** → **Settings** → **Apps**.
- Uninstall **every** “Conversion Optimizer” (or custom app) that is **not** the one you installed from **Dev Dashboard**.
- Keep only the app that you install via Dev Dashboard → your app → **Install** → choose your store.

---

## 8. Try Subscribe again

- Open the app from **Shopify Admin** → **Apps** → **Conversion Optimizer**.
- Click **Subscribe for $19/month**.

If you still get 422:

- Call the **debug** URL again (step 5). If **tokenValid** is still `false`, do step 6 again and make sure you open the app that was installed from **Dev Dashboard** (step 7).
- If **tokenValid** is `true` and you still get 422, the token may still be from a store-owned app: uninstall all Conversion Optimizer apps (step 7), do step 6, then install **only** from Dev Dashboard and open that app, then try Subscribe again.

---

## Quick links (your project)

| What              | URL |
|-------------------|-----|
| Debug (check app + token) | https://conversion-optimizer-api-production.up.railway.app/api/auth/debug?shop=conversionoptimizer.myshopify.com |
| Forget shop (re-auth)     | https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com |
| Dev Dashboard            | https://dev.shopify.com/dashboard |

Your Railway app URL is correct: **conversion-optimizer-api-production.up.railway.app**. Use it as above and in **SHOPIFY_APP_URL** (with `https://`, no trailing slash).
