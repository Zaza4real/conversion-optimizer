# How to configure your Shopify app (App URL + Redirect URL)

Shopify has two dashboards. Where you set the App URL and redirect URL depends on how your app was created.

---

## Option A: You use **Partners** (partners.shopify.com)

1. Go to **[partners.shopify.com](https://partners.shopify.com)** and sign in.
2. Click **Apps** in the left sidebar.
3. Click your app (e.g. Conversion Optimizer).
4. In the left sidebar of the app, look for:
   - **App setup**, or  
   - **Configuration**, or  
   - **Settings**
5. On that page you should see:
   - **App URL** (or **Application URL**) → set this to your Railway URL, e.g. `https://your-app.up.railway.app` (no trailing slash).
   - **Allowed redirection URL(s)** or **Redirect URLs** → add one line:  
     `https://your-app.up.railway.app/api/auth/callback`
6. Click **Save**.

If you don’t see **App setup** or **Configuration**:

- Look for **App details** or a **Settings** / gear icon.
- Some accounts use the **Dev Dashboard** instead (see Option B).

---

## Option B: You use the **Dev Dashboard** (dev.shopify.com)

1. Go to **[dev.shopify.com](https://dev.shopify.com)** and sign in (or open the link from Partners).
2. Open your app from the dashboard.
3. Go to the **Versions** (or **Releases**) section.
4. Either:
   - **Edit** the current version, or  
   - **Create** a new version / release.
5. In the version configuration you should see:
   - **App URL** / **Application URL** → set to your Railway URL.
   - **Redirect URLs** → add `https://your-app.up.railway.app/api/auth/callback`
6. Save and **Release** / **Deploy** the version if needed.

---

## If you still can’t find the fields

**“I don’t see App URL or Redirect URL”**

- Your app might be **CLI-managed**. In that case:
  - In your project, create a file **`shopify.app.toml`** (in the repo root or where your app config lives).
  - Set `application_url` and `auth.redirect_urls` there, then run `shopify app deploy` (or the deploy command from Shopify CLI).
- Or use the **same** dashboard where you found **Client ID** and **Client secret** — the URL settings are usually on the same or a nearby page (e.g. “App setup”, “Configuration”, “URLs”).

**“The field is disabled or I get an error”**

- Ensure the URL uses **https** (not http).
- No trailing slash: use `https://your-app.up.railway.app` not `https://your-app.up.railway.app/`.
- Redirect URL must be **exactly**: `https://your-app.up.railway.app/api/auth/callback` (same host as App URL, path `/api/auth/callback`).

**“I have a Custom app, not a Partners app”**

- Custom apps (created from a store’s Admin → Settings → Apps and sales channels → Develop apps) have fewer options. For OAuth with a backend, create a **development app** in **Partners** (Apps → Create app → Create app manually) and configure it as above.

---

## Quick checklist

- [ ] App URL = `https://YOUR-RAILWAY-URL` (no trailing slash)
- [ ] Redirect URL = `https://YOUR-RAILWAY-URL/api/auth/callback`
- [ ] Both saved in the same app you use for Client ID / Client secret

Replace `YOUR-RAILWAY-URL` with your real Railway domain (e.g. `conversion-optimizer-api-production-xxxx.up.railway.app`).
