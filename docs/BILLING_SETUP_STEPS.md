# Get billing working – step-by-step (current UI)

Do every step in order. Use **your real backend URL** if it’s not the one below.

---

## Part A: One app from Dev Dashboard (the one that can charge)

### A1. Open Dev Dashboard

- Go to: **https://dev.shopify.com/dashboard**
- Log in with your Shopify account.

### A2. Create the app (if you don’t have one yet)

- In the **left sidebar**, click **Apps**.
- In the **top-right**, click **Create app**.
- Enter an **App name** (e.g. `Conversion Optimizer`).
- Click **Create**.
- When asked how to start, choose **Start from Dev Dashboard**.

### A3. Create a version (required before install)

- In the **left sidebar** of your app, click **Versions**.
- Create a new version (e.g. click **Create version** or similar).
- In that version, set:
  - **App URL:**  
    `https://conversion-optimizer-api-production.up.railway.app`
  - **Redirect URLs** (or **Allowed redirection URLs**): add exactly:  
    `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback`
  - **Scopes:** at least  
    `read_products`, `read_orders`, `read_themes`
- Save/Release the version.

### A4. Copy credentials

- In the **left sidebar**, click **Settings**.
- Copy:
  - **Client ID**
  - **Client secret**  
  (You’ll paste these into Railway in Part B.)

---

## Part B: Backend uses this app only

### B1. Set variables in Railway

- Open **Railway** → your project → the **service that runs your backend** (NestJS).
- Open **Variables** (or **Settings** → Variables).
- Set:
  - **SHOPIFY_API_KEY** = the **Client ID** from A4 (replace any existing value).
  - **SHOPIFY_API_SECRET** = the **Client secret** from A4 (replace any existing value).
- **SHOPIFY_APP_URL** should be (no trailing slash):  
  `https://conversion-optimizer-api-production.up.railway.app`
- Save. Wait for the service to **finish redeploying** (check **Deployments**).

---

## Part C: Store has only this app (no old “Conversion Optimizer”)

### C1. Remove old app from the store

- In **Shopify Admin** (your store), go to **Settings** (gear icon, bottom left).
- Click **Apps** (or **Apps and sales channels**).
- In the list, find **Conversion Optimizer** (or any custom app you created for this project).
- For **each** of those, click it → **Uninstall** (or **Remove app**).  
  You want **no** old “Conversion Optimizer” or custom app left on the store.

---

## Part D: Clear stored token and re-install

### D1. Delete the shop in your database

Use **one** of these.

**Option 1 – Forget URL** (only works if this route is deployed):

Open in the browser:

```
https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com
```

(Use your real store domain if different.)

**Option 2 – SQL** (if the link above gives 404 or you prefer):

- In **Railway**, open your **Postgres** service.
- Use **Query** / **Connect** (or any SQL client connected to that DB).
- Run:

```sql
DELETE FROM shops WHERE domain = 'conversionoptimizer.myshopify.com';
```

(Use your real store domain if different.)

### D2. Install the Dev Dashboard app on the store

- Go back to **Dev Dashboard** (dev.shopify.com/dashboard) → **Apps** → your app.
- Click **Install** (or the button that lets you install on a store).
- Choose the store **conversionoptimizer.myshopify.com** (or your store).
- Complete the flow and click **Install app** when asked.

### D3. Open the app from the store

- In **Shopify Admin**, go to **Apps** (left sidebar or Settings → Apps).
- Click **Conversion Optimizer** (the one you just installed from Dev Dashboard).
- The app will load; you may be asked to **approve** it again. Click **Install** / **Approve**.
- After that, the backend will save a **new** token for the **Dev Dashboard** app.

---

## Part E: Try Subscribe

- Inside the app, click **Subscribe for $19/month**.
- You should see Shopify’s charge approval screen (no 422 error).

---

## If you still get 422

1. **Check which app the backend uses**  
   Open (after deploy):  
   `https://conversion-optimizer-api-production.up.railway.app/api/auth/debug?shop=conversionoptimizer.myshopify.com`  
   Compare **clientIdPreview** with the **Client ID** in Dev Dashboard → your app → **Settings**. They must match. If not, fix **SHOPIFY_API_KEY** in Railway (Part B) and redeploy.

2. **Ensure only one app**  
   In the store (Settings → Apps), you must have only the app you created in **Dev Dashboard**. Uninstall any other “Conversion Optimizer” or custom app (Part C again).

3. **Ensure token is from the new app**  
   After changing Railway credentials, you must do Part D again (forget or DELETE the shop, then install and open the app from Dev Dashboard) so the new OAuth run saves a token for the new app.

---

## Quick reference

| Where | What to do |
|--------|------------|
| **dev.shopify.com/dashboard** | Apps → Create app / open app → Versions (URLs, scopes) → Settings (Client ID, secret) → Install |
| **Railway** | Backend service → Variables → SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL → Redeploy |
| **Shopify Admin → Settings → Apps** | Uninstall old Conversion Optimizer; only keep the app installed from Dev Dashboard |
| **Database** | DELETE FROM shops WHERE domain = 'your-store.myshopify.com'; then install + open app from Dev Dashboard |
