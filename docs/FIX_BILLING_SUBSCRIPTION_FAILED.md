# Fix "Subscription could not be started"

You see this when the app redirects you back with a billing error. Billing **does work** before the app is in the App Store (draft/unlisted is fine). The failure is usually due to app credentials or token mismatch.

---

## 1. Check Railway variables

In **Railway** → your backend service → **Variables**, confirm:

| Variable | Must match |
|----------|------------|
| **SHOPIFY_APP_URL** | Your app URL, no trailing slash (e.g. `https://conversion-optimizer-api-production.up.railway.app`) |
| **SHOPIFY_API_KEY** | **Client ID** of the app you install from (Partners → your app → Settings / Client credentials) |
| **SHOPIFY_API_SECRET** | **Client secret** of the **same** app |

If the app in Partners was recreated or you have more than one "Conversion Optimizer" app, the token in the database may be for a different app. Use step 2 to fix that.

---

## 2. Reinstall from the correct app (forget + install again)

1. In **Shopify Admin** (your store) → **Settings** → **Apps and sales channels** → uninstall **Conversion Optimizer** (and any other copy of the app if you have two).
2. Open in the browser (replace with your store domain if different):  
   `https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com`  
   This deletes the stored shop/token so the next install does a fresh OAuth.
3. In **Partners** (or Dev Dashboard), open the **one** app you want to use → **Test your app** / **Select store** → install on your store and **open the app**.
4. In the app, click **Subscribe** (Growth or Pro) and approve the charge on Shopify.

---

## 3. Check logs for the real error

After you click Subscribe, if it still fails:

1. **Railway** → your service → **Deployments** → latest deploy → **View logs**.
2. Look for lines starting with **`[Billing]`** right when you tried to subscribe. You might see:
   - **`[Billing] create subscription failed 422 ...`** → Shopify rejected the charge (e.g. app not allowed to bill, or token for wrong app). Fix credentials and reinstall (step 2).
   - **`[Billing] subscribe failed: Shop not found`** → No token for this store. Open the app once from Admin so OAuth runs, then try Subscribe again.
   - **`[Billing] GraphQL errors ...`** → Message will say why (e.g. permission, plan). Fix the cause and try again.

---

## 4. Confirm token matches your app (optional)

Open (use your store domain if different):

`https://conversion-optimizer-api-production.up.railway.app/api/auth/debug?shop=conversionoptimizer.myshopify.com`

- **tokenMatchesOurApp: true** → Stored token is for the app in Railway (SHOPIFY_API_KEY). If billing still fails, check logs (step 3).
- **tokenMatchesOurApp: false** or **tokenValid: false** → Token is for another app or invalid. Do step 2 (forget + reinstall from the correct app).

---

## 5. If you still get 422

If logs show **422** and something like "migrated to partners" or "owned by a Shop", use a **new app** created only in Partners (never from a store) and point Railway at that app’s Client ID and secret. See **FIX_422_NEW_APP_STEPS.md**.

---

## Summary

1. Set **SHOPIFY_APP_URL**, **SHOPIFY_API_KEY**, **SHOPIFY_API_SECRET** in Railway to the **same** app you install from.
2. Run **/api/auth/forget?shop=your-store.myshopify.com**, then **reinstall** the app from Partners and open it.
3. Try **Subscribe** again. If it fails, check **Railway logs** for `[Billing]` to see the exact error.
