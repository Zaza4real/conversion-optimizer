# Conversion Optimizer — Technical Plan

## 1. Product summary

Self-serve CRO app that: (1) scans the store and funnel, (2) produces a prioritized, quantified action plan, (3) applies changes only via Shopify-native extensions (theme blocks, app embed, optional checkout), and (4) runs experiments with causal attribution and safe rollback.

**Core promise:** Connect store → within ~15 minutes, get a prioritized list of fixes with impact estimates; optionally run autopilot A/B tests with deploy, track, and recommend winners using proper stats.

**Constraints we respect:** No raw theme file edits. All storefront changes via Theme App Extension (blocks + app embed). Tracking via Web Pixel only. Admin UX embedded. Progressive OAuth (read-first; write only when merchant enables “apply directly”).

---

## 2. Tech stack (chosen and why)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | **Node + NestJS** | Single language with admin app; strong TS typing; BullMQ, GraphQL client, and Shopify tooling are first-class. |
| DB | **Postgres 15+** | JSONB for events/props; partitioning for `events`; mature indexing. |
| Queue | **Redis + BullMQ** | Same Redis as cache; retries, backpressure, idempotency keys; no extra vendor. |
| Cache | **Redis** | Sessions, product/theme cache, rate limits, experiment assignment cache. |
| Object storage | **S3-compatible (e.g. R2/MinIO)** | Patches, exports, report artifacts. |
| Admin app | **Next.js 14 (App Router) + Polaris** | Embedded app; SSR where needed; Polaris for Shopify-native UX. |
| Infra | **Docker, Docker Compose** | Single `docker-compose.yml` for local; same images for staging/prod. IaC outline for Terraform/Pulumi. |
| Observability | **Structured JSON logs, OpenTelemetry (optional), Sentry** | Logs to stdout; traces for jobs and API; errors to Sentry. |

We avoid depending on GA or external analytics for the core funnel; we own the event pipeline from pixel → our DB → aggregates.

---

## 3. v1 feature set (shippable in 6–8 weeks)

**In scope:**

- **Connect & scan:** OAuth (read-only: products, orders, themes). One-time “scan” job: fetch active theme structure, product sample, policies; run CRO lint rules; produce top-N recommendations with impact scores.
- **Product page optimizer:** Recommendations for product copy (title, bullets, FAQ), media (count, alt, order), pricing presentation, variant UX. Patches map to theme block config or product metafields/API when write is enabled.
- **AI copy pipeline:** Structured JSON output (titles, bullets, FAQ, shipping/returns snippet, CTAs). Brand voice settings (tone, taboo words, claim strictness). Compliance guardrails; diff view and approve/apply.
- **Trust & shipping blocks:** Theme App Extension blocks: Trust/Guarantee, Shipping & Returns, FAQ, Urgency/Stock, Social proof. App embed for experiment toggles and variant rendering.
- **Web Pixel:** `page_view`, `product_view`, `add_to_cart`, `begin_checkout`, `purchase`. Experiment exposure with `experiment_id` + `variant`; deterministic bucketing; anon_id + session_id persistence (cookie + localStorage fallback).
- **Basic A/B:** Single experiment per placement (e.g. CTA copy, trust block on/off). Deterministic assignment, exposure logging, outcome aggregation, Bayesian evaluation with credible intervals; minimum sample and stopping rules.
- **Safe apply & rollback:** Patches stored with rollback payload; versioned; one-click rollback in admin.

**Out of scope for v1:** Multi-armed bandits, checkout UI extension, competitor benchmarks, image variant testing, personalization, full autopilot (v2).

---

## 4. High-level architecture

```
[Storefront]
  Theme (merchant) + Theme App Extension (our blocks + app embed)
  Web Pixel (our pixel extension)
       ↓ events + exposure
[Our Backend]
  API (NestJS) ← Embedded Admin (Next.js + Polaris)
  Workers (BullMQ): scan, sync, experiment eval, AI copy
  Postgres (shops, products_cache, orders_cache, events, recommendations, patches, experiments, assignments, results_aggregates)
  Redis (cache, queue, assignment cache)
  S3 (patch artifacts, exports)
```

- **Admin:** Next.js app embedded in Shopify Admin. Uses session token / App Bridge; calls our backend API. No direct Shopify API from browser (backend holds tokens).
- **Theme extension:** Renders blocks and injects minimal JS for experiments. No direct backend calls from storefront for critical path; config comes from extension settings / metafields if needed.
- **Pixel:** Sends events to Shopify’s pixel endpoint (and/or our collector if we add one); we persist via webhook or pixel server-side forward. For v1 we use pixel → our ingestion endpoint (Shopify allows sending to custom endpoint in pixel).
- **Webhooks:** All handled by backend; idempotent by `webhook_id` or `order_id`/`product_id`; HMAC verified.

---

## 5. Security and privacy

- **Tokens:** Encrypted at rest (e.g. libsodium secretbox or KMS envelope). Key from env; rotation path documented.
- **Webhooks:** HMAC-SHA256 verification; reject invalid.
- **PII:** Store `anon_id`, `session_id`; order-level we store `order_id`, totals, line item ids/counts. No customer email/name in events table; optional in orders_cache only if needed for attribution, with retention limit.
- **GDPR:** DPA notes; export (shops + their events/orders by anon_id); delete on uninstall (cascade). Data retention config (e.g. events 90 days, aggregates kept).
- **Scopes:** Default `read_products`, `read_orders`, `read_themes`. `write_products` only when merchant turns on “Apply changes directly.”

---

## 6. v2 direction (not implemented in v1)

- Multi-armed bandits for variant selection.
- Segmentation: device, new/returning, traffic source; personalized copy per segment.
- Competitor benchmarks (opt-in, anonymized): “72% of similar stores have X”.
- Automated image variant tests (hero vs lifestyle).
- Full autopilot: suggest N experiments/week, auto-deploy, auto-report, winner suggestion with guardrails.
- Counterfactual impact estimates from historical data before running tests.
- Checkout UI extension for post-purchase or limited checkout tweaks.

---

## 7. Platform constraints we work within

- **Theme:** We don’t edit theme files. We use Theme App Extension so merchants add blocks; we can’t force placement—we recommend where to add them.
- **Pixel:** Event payload and rate limits as per Shopify; we don’t get full page HTML or DOM. We get structured events.
- **Checkout:** Locked down; we only add checkout extension if we implement it; v1 works without it.
- **Rate limits:** Admin API and Storefront API have limits; we use bulk/async jobs and backoff.
