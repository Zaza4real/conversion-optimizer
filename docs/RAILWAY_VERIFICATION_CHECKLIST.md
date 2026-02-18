# Railway verification checklist

Use this to confirm your **conversion-optimizer-api** service and project are set up correctly. Your app URL is:

**`https://conversion-optimizer-api-production.up.railway.app`** (no trailing slash)

---

## 1. Project structure

In your Railway **project**, you should have **three services**:

| Service | Purpose |
|--------|---------|
| **conversion-optimizer-api** (or your backend service name) | Builds and runs the NestJS app from GitHub |
| **PostgreSQL** | Database |
| **Redis** | Queue (BullMQ) for scan jobs |

If you only have the app service, add Postgres and Redis from the Railway template or **+ New** → **Database** / **Redis**.

---

## 2. Backend service – build settings

Click the **app service** (the one from GitHub) → **Settings**.

- **Root Directory** (or “Source” → Root directory): must be **`apps/backend`**.
  - If you leave it blank, Railway builds from the repo root. Then you must set **Build Command** = `npm run railway:build` and **Start Command** = `npm run railway:start` (from the root `package.json`).
- If Root Directory is **`apps/backend`**, Railway uses **`apps/backend/railway.toml`**:
  - **Build:** `npm install && npm run build`
  - **Start:** `npm run start`

Confirm either:
- Root = `apps/backend`, or  
- Root = blank and custom Build/Start commands point to the backend.

---

## 3. Required variables (conversion-optimizer-api → Variables)

Set these on the **app service** (not on Postgres/Redis). Use **Reference** from Postgres/Redis when possible so URLs stay in sync.

| Variable | Required | Where to get it | Example / note |
|----------|----------|-----------------|-----------------|
| **DATABASE_URL** | Yes | Postgres service → Variables → copy or **Reference** | Use **internal** URL for the app (e.g. `postgres.railway.internal`) when Railway offers it, so the app talks to DB inside Railway. |
| **REDIS_URL** | Yes | Redis service → Variables → copy or **Reference** | Often `REDIS_PRIVATE_URL` or `REDIS_URL` from the Redis plugin. |
| **ENCRYPTION_KEY** | Yes | Generate: `openssl rand -hex 32` | Any 32+ character secret; same value everywhere if you run app in multiple places. |
| **SHOPIFY_API_KEY** | Yes | Dev Dashboard → your app → Settings → **Client ID** | e.g. `f1b31cf1dd10ef4c87caf06fcb065c81` |
| **SHOPIFY_API_SECRET** | Yes | Dev Dashboard → your app → Settings → **Client secret** | e.g. `shpss_...` |
| **SHOPIFY_APP_URL** | Yes | Your app’s public URL (see below) | `https://conversion-optimizer-api-production.up.railway.app` — **no trailing slash** |
| **SHOPIFY_SCOPES** | Optional | Default in code if missing | e.g. `read_products,read_orders,read_themes` |
| **NODE_ENV** | Optional | Set to `production` | Recommended for production. |
| **PORT** | Optional | Railway usually sets this | Backend uses `process.env.PORT || 4000`. |
| **BILLING_TEST** | Optional | Set to `true` for test charges | Only if you want Shopify test mode billing. |

**SHOPIFY_APP_URL** must be exactly the public URL of this same service (Settings → Networking → generated domain), with `https://` and **no trailing slash**.

---

## 4. Networking (public URL)

- Open the **app service** → **Settings** → **Networking** (or **Public Networking**).
- You must have a **generated domain** (e.g. `conversion-optimizer-api-production.up.railway.app`).
- **SHOPIFY_APP_URL** in Variables must match: `https://<that-domain>` (no trailing slash).

---

## 5. Postgres – internal vs public URL

- **For the app service (Variables → DATABASE_URL):** Prefer the **internal** Postgres URL (host like `postgres.railway.internal` or similar) so the API connects inside Railway. Use “Reference” from the Postgres service if available.
- **For running migrations from your Mac:** Use the **public** Postgres URL (host like `maglev.proxy.rlwy.net` or `*.railway.app`) from Postgres → Variables / Connect. Do not commit this URL.

---

## 6. Quick sanity checks

After saving variables and redeploying:

1. **Health:** Open  
   `https://conversion-optimizer-api-production.up.railway.app/`  
   You should see the app (or a redirect). No 502/503.

2. **Debug (app + token):**  
   `https://conversion-optimizer-api-production.up.railway.app/api/auth/debug?shop=YOUR-STORE.myshopify.com`  
   - **clientIdPreview** should match your Dev Dashboard app’s Client ID (e.g. `f1b3...5c81`).
   - If you have a shop installed, **tokenMatchesOurApp** and **tokenAppDeveloperType** help confirm the token is for the right app.

3. **Shopify:** In Dev Dashboard, **App URL** and **Redirect URL** must be:
   - App URL: `https://conversion-optimizer-api-production.up.railway.app`
   - Redirect: `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback`

---

## 7. Common issues

| Issue | What to check |
|-------|----------------|
| Build fails | Root Directory = `apps/backend` or custom Build command from repo root. |
| 502 / App not starting | Logs in Railway → app service → **Deployments** → latest → **View logs**. Often missing **DATABASE_URL** or **REDIS_URL**. |
| “Wrong” app (billing 422) | **SHOPIFY_API_KEY** and **SHOPIFY_API_SECRET** must be from Dev Dashboard (Partners) app. Then run forget, re-open app, try Subscribe again. |
| Redirect/callback errors | **SHOPIFY_APP_URL** no trailing slash; Redirect URL in Dev Dashboard exactly `.../api/auth/callback`. |
| DB connection errors | Use **internal** Postgres URL for **DATABASE_URL** on the app service when running on Railway. |

---

## Summary

- [ ] Project has **app**, **PostgreSQL**, **Redis**
- [ ] App service **Root Directory** = `apps/backend` (or custom build/start from root)
- [ ] **Variables:** DATABASE_URL, REDIS_URL, ENCRYPTION_KEY, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL (no trailing slash), and optionally SHOPIFY_SCOPES, NODE_ENV=production
- [ ] **Networking:** Domain generated; SHOPIFY_APP_URL matches that domain
- [ ] **Dev Dashboard:** App URL and Redirect URL match SHOPIFY_APP_URL
- [ ] **Debug URL** returns expected clientIdPreview and (if installed) token info
