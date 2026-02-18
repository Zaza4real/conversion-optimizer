# Deploy backend on Railway

You need **three things** in one Railway project:

1. **Your code** (the API from GitHub)
2. **PostgreSQL** (database)
3. **Redis** (for the scan queue)

You already added Postgres and Redis. Next is adding your repo and wiring them together.

---

## What you should see in the project

On the project canvas you should have:

- **PostgreSQL** – database (you have this)
- **Redis** – cache/queue (you have this)
- **One more service** – this must be your GitHub repo (the API). If you don’t see it, add it in the next section.

---

## If you don’t have a service from your repo yet

1. In the same project, click **+ New** (or **Add service**).
2. Choose **GitHub repo** (or **Deploy from GitHub**).
3. Select **Zaza4real/conversion-optimizer** and connect/deploy.
4. Railway will create a new service that builds and runs your code. That service is your **backend / app service**.

---

## Configure the service that runs your code

That service has a name like **conversion-optimizer** or the repo name. **Click that service** (not Postgres, not Redis).

### 1. Tell Railway where the backend code is (Root Directory)

Railway must build from **`apps/backend`** so it runs the NestJS API, not the repo root.

**Where to find it (Railway’s UI changes; try in this order):**

1. Click your **app service** (the one from GitHub).
2. Open **Settings** (gear icon or “Settings” in the left sidebar).
3. On the Settings page, look for:
   - **Source** → **Root Directory** (or “Repository root” / “Root directory”).
   - Or **Build** → **Root Directory**.
   - Or **Deploy** / **Service** → **Root Directory**.
4. Set the value to: **`apps/backend`** (no leading slash). Save.

**If you still don’t see “Root Directory”:**

- Try the **Variables** page: sometimes there’s a **Configure** or **Build configuration** link nearby.
- Or use the **three-dots menu (⋮)** on the service card → **Settings**.
- Newer Railway projects sometimes use a **“Source”** block on the main service view: click **Edit** or the repo name and see if **Root directory** is there.

We added **`apps/backend/railway.toml`** in the repo so build/start are explicit once Railway is using `apps/backend` as the root.

**Workaround if Root Directory never appears:**  
Leave Root Directory blank (repo root). In your app service **Settings** → **Build** (or **Deploy**), set:  
- **Build Command:** `npm run railway:build`  
- **Start Command:** `npm run railway:start`  

Those scripts (in the repo root `package.json`) run the backend from `apps/backend` for you.

### 2. Give it your Postgres and Redis URLs

- Open the **Variables** tab for the **same** service (your app, not Postgres/Redis).
- You need this service to have **DATABASE_URL** and **REDIS_URL**.

**Option A – Reference (if Railway shows it)**  
- Click **Add variable** or **New variable**.
- If you see something like **Reference** or **From service**, use it to pull:
  - **DATABASE_URL** from the **PostgreSQL** service
  - **REDIS_URL** (or **REDIS_PRIVATE_URL**) from the **Redis** service  

**Option B – Copy and paste**  
- Click the **PostgreSQL** service → **Variables** (or **Connect**) → copy **DATABASE_URL**.
- In your **app service** → **Variables** → **Add variable** → name **DATABASE_URL**, value = paste.
- Click the **Redis** service → **Variables** (or **Connect**) → copy **REDIS_URL** (or the URL it shows).
- In your **app service** → **Variables** → **Add variable** → name **REDIS_URL**, value = paste.

### 3. Add the rest of the variables

Still in **Variables** for the **app service**, add:

| Variable            | Value |
|---------------------|--------|
| `NODE_ENV`          | `production` |
| `ENCRYPTION_KEY`    | Any long random string (e.g. 32+ characters), or run `openssl rand -hex 32` in Terminal and paste it |
| `SHOPIFY_API_KEY`   | Your app’s Client ID from Shopify Partners |
| `SHOPIFY_API_SECRET`| Your app’s Client secret from Partners |
| `SHOPIFY_SCOPES`    | `read_products,read_orders,read_themes` |
| `SHOPIFY_APP_URL`   | Leave empty for now; you’ll set it after the first deploy |

Save. Railway will redeploy when you change variables.

---

## Deploy and get a public URL

1. Trigger a deploy (e.g. **Deploy** in the app service, or push a commit to the repo). Wait until the build finishes and the service is **Running**.
2. In the **app service**, open **Settings** → **Networking** (or **Public Networking**).
3. Click **Generate Domain** (or **Add domain**). Railway will give you a URL like **`https://conversion-optimizer-api-production-xxxx.up.railway.app`**.
4. Copy that URL (no trailing slash).

---

## Set SHOPIFY_APP_URL

1. In the **app service** → **Variables**.
2. Add or edit **SHOPIFY_APP_URL** and set it to the URL you just copied (e.g. `https://conversion-optimizer-api-production-xxxx.up.railway.app`).
3. Save. Railway will redeploy.

---

## Run migrations once (from your Mac)

Railway doesn’t run migrations for you. Do it once from your computer using Railway’s Postgres URL:

1. In Railway, click the **PostgreSQL** service → **Variables** (or **Connect**).
2. Copy the full **DATABASE_URL** (starts with `postgresql://`).
3. On your Mac, in Terminal:
   ```bash
   cd "/Users/admin/Downloads/SHOPIFY PROJECT/apps/backend"
   DATABASE_URL="paste_that_full_url_here" npm run migration:run
   ```
   Replace `paste_that_full_url_here` with the real URL (in quotes).

---

## Shopify Partners

1. Go to [partners.shopify.com](https://partners.shopify.com) → your app → **App setup** (or **Configuration**).
2. **App URL** = the same Railway URL (e.g. `https://conversion-optimizer-api-production-xxxx.up.railway.app`).
3. **Allowed redirection URL(s)** → add:  
   `https://your-railway-url.up.railway.app/api/auth/callback`  
   (use your real Railway URL instead of `your-railway-url`).
4. Save.

---

## Test

In the browser open:

**https://YOUR-RAILWAY-URL.up.railway.app/api/auth?shop=YOUR-STORE.myshopify.com**

Use your real Railway URL and a real store name. You should be sent to Shopify to install the app.

---

## Quick checklist

- [ ] Project has 3 services: **app (from GitHub)**, **PostgreSQL**, **Redis**
- [ ] **App service** → Settings → Root Directory = **`apps/backend`**
- [ ] **App service** → Variables: **DATABASE_URL**, **REDIS_URL**, **ENCRYPTION_KEY**, **SHOPIFY_API_KEY**, **SHOPIFY_API_SECRET**, **SHOPIFY_SCOPES**, then **SHOPIFY_APP_URL** (after you generate the domain)
- [ ] **App service** → Networking → **Generate Domain** → copy URL
- [ ] **SHOPIFY_APP_URL** in Variables = that URL
- [ ] Migrations run once from your Mac with Railway’s **DATABASE_URL**
- [ ] Shopify Partners: **App URL** and **Redirect URL** set to that same URL
