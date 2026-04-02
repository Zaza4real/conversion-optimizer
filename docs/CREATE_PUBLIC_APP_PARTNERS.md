# Create a public app on partners.shopify.com (for billing)

Use this so your app can use the Billing API. Public apps can be **unlisted** (not searchable) and still charge.

---

## 1. Create the app

1. Go to **https://partners.shopify.com** and sign in.
2. In the left sidebar click **Apps**.
3. Click **Create app** → **Create app manually** (or **Add app** → **Create app**).
4. When asked **distribution** or **“Who is this app for?”**:
   - Choose **Public** (or “Sell to many merchants” / “App Store”).
   - Do **not** choose “Custom” or “Single merchant”.
5. Finish the flow (name the app, e.g. “Conversion Optimizer”) and create it.

---

## 2. Configure the app

1. Open the new app → **App setup** (or **Configuration**).
2. Set:
   - **App URL:** `https://conversion-optimizer-api-production.up.railway.app`
   - **Allowed redirection URL(s):**  
     `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback`
3. **Save**.

---

## 3. Make it unlisted (optional)

If you don’t want the app in App Store search:

1. In the app → **Distribution** (or **App listing**).
2. **Create listing** or **Manage listing**.
3. Under **App Store visibility** choose **Limit visibility** (unlisted).  
   Billing still works.

---

## 4. Get credentials

1. Go to **Settings** (or **Client credentials**).
2. Copy **Client ID** and **Client secret**.

---

## 5. Point your backend to this app

1. **Railway** → conversion-optimizer-api → **Variables**  
   Set **SHOPIFY_API_KEY** and **SHOPIFY_API_SECRET** to the new Client ID and secret.  
   Save and redeploy.
2. **Shopify Admin** (your store) → **Settings** → **Apps** → uninstall any old Conversion Optimizer app.
3. Open:  
   `https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com`
4. In **Partners** → your app → **Test your app** / **Select store** → install on your store and open the app.
5. In the app, click **Subscribe**. Billing should work because the app is public.

---

## Summary

| Step | Where |
|------|--------|
| Create app, choose **Public** | partners.shopify.com → Apps → Create app |
| Set App URL + Redirect URL | App setup / Configuration |
| Optional: set unlisted | Distribution → App Store visibility |
| Copy Client ID + Secret | Settings |
| Use in Railway + forget + reinstall | Railway, store, forget URL, Partners |
