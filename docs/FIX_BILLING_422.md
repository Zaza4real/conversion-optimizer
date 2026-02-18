# Fix "Application must be migrated to the Shopify partners area" (422)

Do these steps **in order**. Don’t skip any.

---

## Step 1: Get the NEW app’s credentials (Dev Dashboard)

1. Go to **https://dev.shopify.com/dashboard/**
2. Open **Apps** → click your app (the one you created with “Start from Dev Dashboard”).
3. Open **Settings**.
4. Copy:
   - **Client ID**
   - **Client secret**

Keep this tab open so you can paste these into Railway in Step 2.

---

## Step 2: Point Railway at the NEW app only

1. Open **Railway** → your project → the **backend** service.
2. Go to **Variables**.
3. Set:
   - **SHOPIFY_API_KEY** = paste the **Client ID** from Step 1 (replace any existing value).
   - **SHOPIFY_API_SECRET** = paste the **Client secret** from Step 1 (replace any existing value).
4. Save. Wait for the service to **redeploy** and finish (check Deployments).

---

## Step 3: Only the NEW app should be on the store

1. In **Shopify Admin** go to **Settings** → **Apps and sales channels** (or **Apps**).
2. Find **Conversion Optimizer** (or any custom app that is your app).
3. **Uninstall every copy** of it.  
   (If you have two, uninstall both. We’ll install only the new one in Step 5.)

---

## Step 4: Clear the shop in your database (so we get a new token)

Use **one** of these.

**Option A – Use the forget URL (needs latest backend deployed)**  
In the browser, open (replace with your real backend URL if different):

```
https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=conversionoptimizer.myshopify.com
```

If you get **404**, use Option B.

**Option B – Delete the shop in the database**  
1. In **Railway**, open your **Postgres** service.  
2. Use **Connect** / **Query** (or any client that can run SQL).  
3. Run:

```sql
DELETE FROM shops WHERE domain = 'conversionoptimizer.myshopify.com';
```

(Use your real store domain if it’s different.)

---

## Step 5: Install and open only the NEW app

1. In the **Dev Dashboard** (dev.shopify.com), open your app.
2. Use **Install** (or the install flow) and choose the store **conversionoptimizer.myshopify.com**.
3. Complete the install (approve the app when Shopify asks).
4. In **Shopify Admin** go to **Apps** → open **Conversion Optimizer** (the one you just installed).

Your backend will not find the shop (you deleted it), so it will send you through **OAuth for the new app**. Approve again if asked. After that, the backend will save a **new access token** for the Dev Dashboard app.

---

## Step 6: Try Subscribe again

In the app, click **Subscribe for $19/month**.

You should no longer get the 422 “owned by a Shop” error, because:

- Railway uses the **new** app’s Client ID and Client secret.
- The store has only the **new** app installed.
- The only token in the DB was just issued by the **new** app’s OAuth.

---

## If it still returns 422

- Confirm in Railway that **SHOPIFY_API_KEY** is **exactly** the Client ID from **Dev Dashboard** → your app → Settings (no spaces, same app).
- Confirm you **uninstalled** every old/custom “Conversion Optimizer” and only **installed from the Dev Dashboard** in Step 5.
- Confirm you did **Step 4** (forget URL or `DELETE FROM shops`) **before** Step 5, so the token we have is from the new app’s OAuth.
