# Backend (NestJS)

API and background jobs for Conversion Optimizer.

- REST + optional GraphQL for admin app.
- BullMQ workers: shop sync, scan (CRO lint), AI copy, experiment evaluation.
- Webhook handlers (idempotent, HMAC-verified).
- All Shopify API calls from backend using stored encrypted tokens.

Env: `DATABASE_URL`, `REDIS_URL`, `SHOPIFY_*`, `ENCRYPTION_KEY`, `S3_*`.
