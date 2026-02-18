# Milestones: v1 in 6–8 weeks

## Build order (what to build first)

1. **Repo + infra** — Monorepo, Docker (Postgres, Redis), env, backend skeleton (NestJS), admin skeleton (Next.js + Polaris).
2. **Auth + shop storage** — OAuth with Shopify, encrypt and store token, shops table, install/uninstall webhook.
3. **Core API + webhooks** — REST routes for admin app; webhook endpoint with HMAC; idempotent handlers (products, orders, themes, shop, app_uninstalled).
4. **DB + sync** — Run migrations; product/order sync jobs (GraphQL); products_cache and orders_cache populated.
5. **Scan + recommendations** — Rule registry (30 CRO rules); scan job (theme + products); write to recommendations table; scoring and top-N.
6. **Theme extension** — Blocks (Trust, Shipping/Returns, FAQ, Urgency, Social proof); app embed with minimal JS; deploy via Shopify CLI.
7. **Pixel extension** — Subscribe to events; anon_id/session_id; POST to backend; events table; deterministic bucketing and exposure.
8. **Recommendation UI** — Dashboard with top 10; recommendation detail; diff view; apply (product/metafield) and rollback.
9. **AI copy** — Prompt pipeline, JSON schema, guardrails; “Generate copy” and “Apply” from recommendation.
10. **Experiments** — Create experiment (target, variants, allocation); assignment in pixel; exposure + outcome logging; aggregation job; Bayesian evaluation; experiment detail UI and winner recommendation.
11. **First-run polish** — “Scan my store” flow, progress, empty states, tracking health hint.
12. **Observability** — Structured logs, Sentry, job metrics; tracking-gap check and dashboard card.

---

## Week-by-week (8-week target)

| Week | Focus | Deliverables |
|------|--------|--------------|
| 1 | Repo, infra, auth | Monorepo; Docker; NestJS + Next apps; OAuth; shops table; APP_UNINSTALLED webhook |
| 2 | Data and webhooks | Migrations; GraphQL product/order queries; webhooks (products, orders, themes, shop); sync jobs; products_cache + orders_cache |
| 3 | Scan and rules | Rule registry (30 rules); scan job; recommendations table; scoring; API: GET /shops/:id/recommendations, POST /shops/:id/scan |
| 4 | Theme extension | Theme App Extension with 5 blocks; app embed script (stub); install instructions; block settings schema |
| 5 | Pixel and events | Web Pixel Extension; anon_id/session_id; POST /pixel/events; events table; assignment + exposure; aggregation query |
| 6 | Apply and rollback | Patch payload types; apply service (product/metafield); patches table; rollback; UI: apply + rollback + diff |
| 7 | AI copy + experiments | AI prompt pipeline; Zod schema; “Generate copy” and apply; experiment CRUD; assignment in embed; exposure + outcomes; aggregation job; Bayesian eval; experiment UI |
| 8 | Polish and ship | First-run flow (scan → top 10); tracking health; logs + Sentry; docs; security pass; v1 release |

---

## v2 (after v1)

- Multi-armed bandits; segmentation (device, source); counterfactual impact estimates.
- Autopilot: suggest experiments, auto-deploy, auto-report.
- Competitor benchmarks (opt-in); image variant tests; personalization; checkout extension if needed.
