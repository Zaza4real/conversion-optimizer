# Create a new Shopify app (with URL configuration)

If your current app doesn’t show App URL or Redirect URL, create a new one from **Partners** so you get the full configuration.

---

## 1. Create the app in Partners

1. Go to **[partners.shopify.com](https://partners.shopify.com)** and sign in.
2. In the left sidebar click **Apps**.
3. Click **Create app** → **Create app manually** (do **not** choose “Create from template” or “Create from store”).
4. Enter an **App name** (e.g. “Conversion Optimizer”) and click **Create app**.

---

## 2. Configure URLs

1. In the app’s left sidebar, open **App setup** (or **Configuration**).
2. You should see:
   - **App URL** (or **Application URL**)  
     Set to your Railway URL, e.g. `https://your-app.up.railway.app` (no trailing slash).
   - **Allowed redirection URL(s)** (or **Redirect URLs**)  
     Add: `https://your-app.up.railway.app/api/auth/callback`
3. **Save**.

If you still don’t see these fields, check for a **URLs** or **App URL** section on the same page or under **Settings**.

---

## 3. Get Client ID and Client secret

1. On the same **App setup** / **Configuration** page, find **Client credentials** (or **API credentials**).
2. Copy:
   - **Client ID** → this is your `SHOPIFY_API_KEY`
   - **Client secret** → this is your `SHOPIFY_API_SECRET` (click Reveal if needed).

---

## 4. Set scopes (optional)

Under **Configuration** or **API access**, request at least:

- `read_products`
- `read_orders`
- `read_themes`

(Or set **SHOPIFY_SCOPES** in Railway to match.)

---

## 5. Update Railway and local .env

1. **Railway** → your app service → **Variables**:
   - **SHOPIFY_API_KEY** = new Client ID
   - **SHOPIFY_API_SECRET** = new Client secret
   - **SHOPIFY_APP_URL** = your Railway URL (same as in step 2)
2. Save (Railway will redeploy).

3. **Local** – in your `.env`:
   - Update `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` with the new values (optional, only if you run the backend locally).

---

## 6. (Optional) Delete the old app

- In Partners → **Apps** → open the old app → **Settings** or **App setup** → look for **Delete app** or **Uninstall**.
- Only do this after the new app is working so you don’t lose anything you need.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Partners → Apps → **Create app** → **Create app manually** |
| 2 | App setup → set **App URL** and **Redirect URL** (Railway URL + `/api/auth/callback`) |
| 3 | Copy **Client ID** and **Client secret** |
| 4 | Railway Variables: **SHOPIFY_API_KEY**, **SHOPIFY_API_SECRET**, **SHOPIFY_APP_URL** |
| 5 | Test: `https://YOUR-RAILWAY-URL/api/auth?shop=YOUR-STORE.myshopify.com` |

Creating the app with **Create app manually** from the Partners **Apps** list is what gives you the URL configuration. Apps created from a store’s “Develop apps” often don’t show those fields.
