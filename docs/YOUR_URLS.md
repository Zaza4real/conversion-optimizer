# Your project URLs – what each one is for

Use this to know which URL to use where.

---

## 1. Backend / API (your Nest app on Railway)

**URL:** `https://conversion-optimizer-api-production.up.railway.app`

**Where it comes from:** Railway → **conversion-optimizer-api** service → **Settings** → **Public Networking** (or **Networking**) → the domain shown there.

**Use it for:**
- **SHOPIFY_APP_URL** in Railway Variables and in `.env` (local)
- **App URL** in Shopify Dev Dashboard (your app → Versions)
- **Redirect URL** in Dev Dashboard = this URL + `/api/auth/callback`, i.e.  
  `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback`
- Opening the app in the browser, e.g.  
  `https://conversion-optimizer-api-production.up.railway.app/?shop=conversionoptimizer.myshopify.com`
- Forget and debug:  
  `https://conversion-optimizer-api-production.up.railway.app/api/auth/forget?shop=...`  
  `https://conversion-optimizer-api-production.up.railway.app/api/auth/debug?shop=...`

So: **this is your “real” app URL** for Shopify and for visiting your backend.

---

## 2. Postgres database (Railway)

You have **two** database URLs; they point at the same DB but are used in different places.

### Internal URL (only inside Railway)

- **Host:** `postgres.railway.internal` (or similar)
- **Used by:** Your **conversion-optimizer-api** service when it runs on Railway.
- **Set how:** In Railway, on the **conversion-optimizer-api** service, add a variable **DATABASE_URL** and set it from the **Postgres** service (e.g. “Reference” or copy from Postgres → Variables). Railway often gives you the internal URL when you reference the Postgres service.
- **Do not use** this URL from your laptop (it will not resolve).

### Public URL (from your laptop)

- **Host:** something like `maglev.proxy.rlwy.net` (and a port).
- **Where to find it:** Railway → **Postgres** service → **Variables** or **Connect** → look for a URL whose host is **not** `postgres.railway.internal` (e.g. `maglev.proxy.rlwy.net` or `*.railway.app`). That is your **public** database URL.
- **Use it for:** Running `psql` from your Mac, or connecting with a DB client (TablePlus, etc.). **Do not commit this URL** (it contains the password).

So: **internal** = for the API on Railway; **public** = for you from your computer.

---

## 3. Shopify store

**Store domain:** `conversionoptimizer.myshopify.com`  
Use this in `?shop=conversionoptimizer.myshopify.com` when opening your app or calling forget/debug.

---

## Quick reference

| What you need           | URL / value |
|-------------------------|-------------|
| App / backend URL       | `https://conversion-optimizer-api-production.up.railway.app` |
| Auth callback URL       | `https://conversion-optimizer-api-production.up.railway.app/api/auth/callback` |
| SHOPIFY_APP_URL (env)   | `https://conversion-optimizer-api-production.up.railway.app` |
| Store (shop param)      | `conversionoptimizer.myshopify.com` |
| DB (from your laptop)   | Postgres **public** URL from Railway (host like `maglev.proxy.rlwy.net`) – do not commit |
| DB (for API on Railway) | **Internal** DATABASE_URL from Railway Postgres (often via “Reference”) |

Your **real URL** for the app and for Shopify is:  
**`https://conversion-optimizer-api-production.up.railway.app`**
