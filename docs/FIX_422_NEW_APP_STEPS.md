# Fix 422 “owned by a Shop” – use a new Dev Dashboard app

When Shopify returns **422** with *"It must be migrated to the Shopify partners area before it can create charges"*, the app that issued your current token is treated as **store-owned**. Even if your Dev Dashboard app has the right credentials, that app may have been created from a store or migrated in a way that blocks billing.

The most reliable fix is to use a **brand-new app** created only in the Dev Dashboard (never from a store).

---

## Step 1: Create a new app in Dev Dashboard

1. Go to **https://dev.shopify.com** (or partners.shopify.com) → **Apps**.
2. Click **Create app** → **Create app manually** (or **Start from Dev Dashboard**).
3. Give it a **new name** (e.g. **Conversion Optimizer Pro** or **Conversion Optimizer 2**) so it’s clearly different from any store app.
4. Open the app → **Configuration** / **App setup** (or **Versions** → your version).
5. Set:
   - **App URL:** `https://conversion-optimizer-api-production.up.railway.app`
   - **Allowed redirection URL(s):**  
     `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback`
6. **Save**. Then go to **Settings** (or **Client credentials**) and copy the **Client ID** and **Client secret**.

---

## Step 2: Update Railway

1. Railway → **conversion-optimizer-api** → **Variables**.
2. Set:
   - **SHOPIFY_API_KEY** = new app’s **Client ID**
   - **SHOPIFY_API_SECRET** = new app’s **Client secret**
3. Leave **SHOPIFY_APP_URL** as is. Save and let Railway **redeploy**.

---

## Step 3: Clear the old token and old app

1. In **Shopify Admin** (your store) → **Settings** → **Apps and sales channels** → uninstall **every** “Conversion Optimizer” (and any custom app that was this backend).
2. Open in the browser (to delete the shop row and force new OAuth):  
   `https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com`  
   (Use your real store domain if different.)

---

## Step 4: Install only the new app

1. In **Dev Dashboard**, open the **new** app you created in Step 1.
2. Use **Test on store** / **Install app** and choose your store (e.g. conversionoptimizer.myshopify.com).
3. Approve the install and **open the app** so OAuth runs and a new token is stored for the new app.

---

## Step 5: Subscribe again

1. In the app, click **Subscribe**.
2. Approve the charge on Shopify. You should no longer get 422.

---

## Optional: Confirm which app the token is for

After deploying the latest backend (with the debug GraphQL app check), open:

`https://conversion-optimizer-api-production.up.railway.app/api/auth/debug?shop=conversionoptimizer.myshopify.com`

- **tokenAppApiKey** should equal the **new** app’s Client ID.
- **tokenMatchesOurApp** should be **true**.
- **tokenAppDeveloperType** (e.g. `PARTNER`) confirms the app type.

If you still get 422 after this, contact **Shopify Support** with the exact 422 message and your **new** app’s Client ID and ask them to confirm that the app can create charges.
