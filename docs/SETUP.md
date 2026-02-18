# Conversion Optimizer — Setup

## Prerequisites

- **Node 20+** and **pnpm** (or enable corepack: `corepack enable && corepack prepare pnpm@9 --activate`)
- **Postgres 15** and **Redis** — either via Docker or installed locally (e.g. `brew install postgresql@15 redis` on macOS)

## 1. Install dependencies

From the repo root:

```bash
pnpm install
```

## 2. Environment

A `.env` file already exists at the repo root with defaults. Edit it and set:

- **ENCRYPTION_KEY** — Keep the dev value for local use, or set a 32+ character secret (or 64 hex characters) for production.
- **SHOPIFY_API_KEY**, **SHOPIFY_API_SECRET**, **SHOPIFY_APP_URL** — From your [Shopify Partners](https://partners.shopify.com) app. For local dev, use a tunnel (e.g. ngrok) and set `SHOPIFY_APP_URL` to your tunnel URL.

If you use your own Postgres/Redis (not Docker), set:

- **DATABASE_URL** — e.g. `postgresql://YOUR_USER:YOUR_PASS@localhost:5432/conversion_optimizer`
- **REDIS_URL** — e.g. `redis://localhost:6379` (optional; defaults to localhost:6379)

## 3. Start Postgres and Redis

**Option A — Docker**

```bash
cd infra && docker compose up -d && cd ..
```

**Option B — Homebrew (macOS)**

```bash
brew services start postgresql@15
brew services start redis
# Create DB if needed:
createdb conversion_optimizer
```

(Adjust user/port if your Postgres uses a different user or port; then set `DATABASE_URL` in `.env` accordingly.)

## 4. Create DB and run migrations

**Option A — Setup script (recommended)**  
From the repo root (creates DB if missing, then runs migrations; starts Docker if available):

```bash
chmod +x scripts/setup.sh && ./scripts/setup.sh
```

**Option B — Manual**  
If you use Postgres with a different user (e.g. macOS Homebrew uses your Mac username), set `DATABASE_URL` in `.env` (e.g. `postgresql://YOUR_USER@localhost:5432/conversion_optimizer`). Then:

```bash
cd apps/backend
node scripts/create-db.js    # create DB if it doesn't exist
pnpm run migration:run
cd ../..
```

## 5. Start the backend

```bash
cd apps/backend && pnpm start:dev
```

The API will be at `http://localhost:4000/api`.

## 6. (Optional) Start the admin app

```bash
cd apps/admin && pnpm dev
```

Use a tunnel (e.g. ngrok) and set that URL as `SHOPIFY_APP_URL` in Partners so the embedded app and OAuth callback work.

## Quick test

- **OAuth:** Open `https://YOUR_APP_URL/api/auth?shop=YOUR_STORE.myshopify.com` (with a real store and app URL) to start the install flow.
- **Scan:** After a shop is installed, `POST /api/scan/YOUR_STORE.myshopify.com` to enqueue a scan; then `GET /api/recommendations/YOUR_STORE.myshopify.com` to list recommendations (after the job runs).
