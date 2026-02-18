# Conversion Optimizer

Self-serve CRO for Shopify: diagnose bottlenecks, apply changes via theme extensions, run experiments with proper attribution.

## Repo layout

- `apps/admin` — Embedded Shopify admin app (Next.js + Polaris)
- `apps/backend` — NestJS API + workers
- `extensions/theme-extension` — Theme App Extension (blocks + app embed)
- `extensions/pixel-extension` — Web Pixel Extension
- `packages/shared` — Shared types, constants, validation (optional)
- `docs/` — Technical plan, schemas, specs
- `infra/` — Docker, env example, IaC outline

## Quick start (local)

1. **Env:** A `.env` file exists at the repo root. Edit it and set:
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL` (from [Partners](https://partners.shopify.com))
   - `DATABASE_URL` — if you don’t use Docker, set this to your Postgres URL (e.g. `postgresql://YOUR_MAC_USER@localhost:5432/conversion_optimizer` on macOS with Homebrew Postgres).
   - `ENCRYPTION_KEY` — keep the dev value or set your own (32+ chars).
2. **Install deps:** `pnpm install`
3. **DB + migrations:** `./scripts/setup.sh` (creates DB if needed, runs migrations; uses Docker for Postgres/Redis if available). Or see [docs/SETUP.md](docs/SETUP.md).
4. **Redis:** Start Redis (required for the scan job queue). With Docker: `cd infra && docker compose up -d`. With Homebrew: `brew services start redis`.
5. **Backend:** `cd apps/backend && pnpm start:dev` → API at `http://localhost:4000/api`
6. **Admin (optional):** `cd apps/admin && pnpm dev` — use a tunnel (e.g. ngrok) and set that URL as `SHOPIFY_APP_URL` in Partners.

**Deploy (Railway):** Connect the repo at [railway.app](https://railway.app), add Postgres + Redis, set root to `apps/backend`, add env vars, then follow [docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md). Use the Railway public URL as **SHOPIFY_APP_URL** in Shopify Partners.

## Docs

- [Technical plan](docs/TECHNICAL_PLAN.md)
- [DB schema](docs/SCHEMA.md)
- [GraphQL & webhooks](docs/SHOPIFY_GRAPHQL_WEBHOOKS.md)
- [Pixel & theme extension](docs/PIXEL_AND_THEME_EXTENSION.md)
- [Experimentation](docs/EXPERIMENTATION_ENGINE.md)
- [Recommendations](docs/RECOMMENDATION_ENGINE.md)
- [Milestones](docs/MILESTONES.md)
