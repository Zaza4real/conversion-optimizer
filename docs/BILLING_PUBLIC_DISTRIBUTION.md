# Fix: "Apps without a public distribution cannot use the Billing API"

## What this means

Shopify only allows the **Billing API** for apps with **public distribution**. Your app is currently **custom distribution** (single store / install link), so billing is blocked.

- **Public distribution** (listed or **unlisted**): ✅ Can use Billing API  
- **Custom distribution**: ❌ Cannot use Billing API  

You **cannot change** an existing app from custom to public. You have to use an app that was created with public distribution.

---

## Fix: Use an app with public distribution

### Option A – Create a new app (public, unlisted)

1. In **Dev Dashboard** (dev.shopify.com) → **Apps** → **Create app** → **Create app manually** (or equivalent).
2. When asked for **distribution**, choose **Public distribution** (not Custom).
3. After the app is created, set visibility to **unlisted** if you don’t want it in App Store search:
   - In Partner/Dev Dashboard: open the app → **Distribution** (or **App listing**) → set **App Store visibility** to **Limit visibility** (unlisted).
4. In the new app, set **App URL** and **Redirect URL** to your Railway URL (same as now).
5. Copy the new app’s **Client ID** and **Client secret** from **Settings**.
6. In **Railway** → your service → **Variables**: set **SHOPIFY_API_KEY** and **SHOPIFY_API_SECRET** to the new app’s credentials. Save and redeploy.
7. In **Shopify Admin** → **Settings** → **Apps**: uninstall the old ConversionOptimizer (custom) app.
8. Open:  
   `https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com`
9. Install the **new** app (public/unlisted) on your store from the Dev Dashboard and open it.
10. In the app, click **Subscribe** again. Billing should work.

### Option B – You already have a public app

If you have another app that was created with **public distribution** (even if unlisted), you can use that app’s Client ID and secret in Railway and point this backend at it (same steps as above: set URLs in that app, update Railway vars, forget shop, install that app, then Subscribe).

---

## Summary

| Distribution | Billing API |
|-------------|-------------|
| Public (listed or unlisted) | ✅ Yes |
| Custom | ❌ No |

The error will go away once the backend uses an app that has **public distribution** (and you can keep it unlisted so it doesn’t appear in the App Store).
