# Fix "Subscription could not be started"

You see this when the app redirects you back with a billing error. Billing **does work** before the app is in the App Store (draft/unlisted is fine). Common causes: **Managed Pricing** (see below), app credentials, or token mismatch.

---

## 0. Error: "Managed Pricing Apps cannot use the Billing API"

If Railway logs show:

```text
[Billing] GraphQL errors Managed Pricing Apps cannot use the Billing API (to create charges).
```

your app is set to **Managed Pricing** in Shopify Partners. With that setting, Shopify hosts the plan page and you **cannot** create charges via the Billing API. This codebase uses the Billing API (in-app Subscribe → create recurring charge), so you must use **manual (developer-defined) pricing**.

**Fix: switch to manual pricing in Partners**

1. **Partners** → **Apps** → **All Apps** → open your app (e.g. Conversion Optimizer).
2. Go to the app’s **listing** (e.g. **Distribution** or **Edit listing**).
3. Find **Pricing** / **Pricing plans** → **Manage** → **Settings**.
4. Switch from **Managed pricing** to **Manual pricing** (or “App charges” / “Developer-defined pricing”).
5. Save. Then try **Subscribe** again in the app.

After switching, the existing billing flow (Subscribe → confirmation) will work; no code changes needed. You can switch back to Managed pricing later if you change the app to use Shopify’s hosted plan page instead of the Billing API.

---

## 0b. "The shop cannot accept the provided charge" when you click **Cancel**

If you see this red banner **on Shopify’s “Approve subscription” page** after clicking **Cancel**, that’s expected: Shopify is saying the charge wasn’t accepted because you declined it. No subscription is created; you can close the page or go back to the app. Nothing to fix.

If you see the **same message when you click Approve** (not Cancel), see **section 0c** below.

---

## 0c. "The shop cannot accept the provided charge" when you click **Approve**

You switched to manual pricing but still get this error when you click **Approve**. Common causes:

**1. You’re testing on a development store**

Development stores **cannot accept real (live) charges**. They only accept **test** subscriptions. The app was creating real charges, so the dev store rejected them.

**Fix:** In **Railway** → your backend service → **Variables**, add or set:

- **BILLING_TEST** = `true` (exactly lowercase, no quotes)

Redeploy. Then **start a new subscription** — don’t reuse the old approval page. In the app, click **Subscribe** again (e.g. Pro). The backend will create a **new** charge with `test: true`. On Shopify’s page you should see a **yellow “Test” or “Test billing”** banner and Approve will work. If you don’t see the yellow banner, the page is from an old (non‑test) charge: go back to the app and click Subscribe again after confirming the steps below.

**Check that test mode is active:** Open  
`https://your-api.up.railway.app/api/billing/status?shop=yourstore.myshopify.com`  
in a browser. The JSON should include `"testMode": true`. If it says `false`, the app isn’t seeing BILLING_TEST (variable name, value, or redeploy).

**2. Subscription permissions still pending**

If you recently switched from Managed to Manual pricing, Shopify may need to approve the app’s subscription permissions (can take up to 7 days). Until then, charges can be rejected. Check your app in Partners for any “pending” or “under review” billing/subscription status and wait for approval.

**Not the cause:** The app **does not** need to be listed in the App Store for billing to work. Unlisted/draft apps can use the Billing API and test or real charges on stores you install to.

**Log shows "Creating real subscription (test=false)" but you set BILLING_TEST?**

The app wasn’t seeing BILLING_TEST. Fix it like this:

1. **Railway** → your **backend** service (the one that runs the API) → **Variables**.
2. Add or edit: name **`BILLING_TEST`** (exactly, all caps), value **`true`** (lowercase; no quotes in Railway’s value field).
3. **Save** (Railway will redeploy). Wait for the deploy to finish.
4. Trigger Subscribe again. In logs you should see:  
   `[Billing] BILLING_TEST env: "true" → test: true`  
   and then `Creating TEST subscription`. If you still see `env: ""` or `→ test: false`, the variable isn’t on this service or the deploy didn’t pick it up.

The app now accepts **true**, **True**, **TRUE**, or **1** for test mode. After deploy, try **Switch to Pro** again.

**Other checks if still failing with test mode:**

- The app sends **replacementBehavior: APPLY_IMMEDIATELY** for plan changes. Deploy the latest code.
- Some **development stores** need a **payment method** in Shopify Admin → **Settings → Billing** before they can accept any charge.

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
   - **`[Billing] GraphQL errors Managed Pricing Apps cannot use the Billing API`** → App is on Managed Pricing; switch to **manual pricing** in Partners (see **section 0** above).
   - **`[Billing] GraphQL errors ...`** → Other message will say why (e.g. permission, plan). Fix the cause and try again.

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
