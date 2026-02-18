# Database schema

Postgres 15+. All timestamps in UTC. Use `BIGINT` for Shopify ids where we store them as numbers, or `TEXT` if we keep string form (recommended for consistency with API).

---

## 1. Core tables

### shops

```sql
CREATE TABLE shops (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain            TEXT NOT NULL UNIQUE,
  access_token_enc  BYTEA NOT NULL,
  scope              TEXT,
  plan               TEXT NOT NULL DEFAULT 'starter',
  installed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  settings           JSONB NOT NULL DEFAULT '{}',
  uninstalled_at     TIMESTAMPTZ
);

CREATE INDEX idx_shops_domain ON shops(domain);
CREATE INDEX idx_shops_installed ON shops(installed_at) WHERE uninstalled_at IS NULL;
```

- `settings`: brand_voice, autopilot_limits, data_retention_days, allow_write_products, etc.
- On uninstall set `uninstalled_at`; background job can hard-delete or anonymize after retention.

### products_cache

```sql
CREATE TABLE products_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  handle      TEXT NOT NULL,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, product_id)
);

CREATE INDEX idx_products_cache_shop ON products_cache(shop_id);
CREATE INDEX idx_products_cache_shop_updated ON products_cache(shop_id, updated_at);
```

- `data`: title, body_html, variants (id, title, price, compare_at_price, available), images (id, src, alt), options, etc. Enough for lint and recommendations.

### orders_cache

```sql
CREATE TABLE orders_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_id     TEXT NOT NULL,
  total        DECIMAL(14,2) NOT NULL,
  subtotal     DECIMAL(14,2),
  line_count   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  attribution  JSONB,
  UNIQUE(shop_id, order_id)
);

CREATE INDEX idx_orders_cache_shop ON orders_cache(shop_id);
CREATE INDEX idx_orders_cache_shop_created ON orders_cache(shop_id, created_at);
```

- `attribution`: source_name, landing_site, referring_site if we get them; experiment_id/variant when we link order to exposure.

---

## 2. Events (partitioned)

High volume. Partition by month on `ts`. Use `LIST` or `RANGE` on `(shop_id, date_trunc('month', ts))` or simpler: partition by month on `ts` only if we don’t need to drop by shop (we can still delete by shop_id in queries).

```sql
CREATE TABLE events (
  id           BIGSERIAL,
  shop_id      UUID NOT NULL,
  anon_id      TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  props        JSONB NOT NULL DEFAULT '{}',
  product_id   TEXT,
  experiment_id TEXT,
  variant      TEXT,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

-- Create partitions per month, e.g.:
-- CREATE TABLE events_2025_02 PARTITION OF events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

Indexes on the partition key and common filters (we create indexes on each partition or use a default template):

```sql
CREATE INDEX idx_events_shop_ts ON events(shop_id, ts);
CREATE INDEX idx_events_shop_type_ts ON events(shop_id, event_type, ts);
CREATE INDEX idx_events_experiment ON events(shop_id, experiment_id, variant, ts) WHERE experiment_id IS NOT NULL;
```

- `props`: url, value, currency, cart_token, etc. per event type.
- `experiment_id`/`variant`: set on exposure; outcome events may duplicate for attribution.

Partition management: monthly job creates next partition; old partitions dropped or archived per retention.

---

## 3. Recommendations and patches

### recommendations

```sql
CREATE TABLE recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  entity_type      TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  category         TEXT NOT NULL,
  rule_id          TEXT NOT NULL,
  severity         TEXT NOT NULL,
  rationale        TEXT NOT NULL,
  expected_impact  JSONB,
  patch_payload    JSONB,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_shop_status ON recommendations(shop_id, status);
CREATE INDEX idx_recommendations_shop_entity ON recommendations(shop_id, entity_type, entity_id);
CREATE INDEX idx_recommendations_shop_created ON recommendations(shop_id, created_at DESC);
```

- `entity_type`: product, collection, theme, global.
- `category`: trust, copy, media, pricing, variant_ux, performance, etc.
- `expected_impact`: e.g. `{ "metric": "conversion_rate", "low": 0.01, "high": 0.05 }`.
- `patch_payload`: see Recommendation Engine spec (block type, settings, or product field edits).

### patches

```sql
CREATE TABLE patches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  applied_to      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  rollback_payload JSONB NOT NULL,
  applied_by      TEXT NOT NULL DEFAULT 'merchant',
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_patches_shop ON patches(shop_id);
CREATE INDEX idx_patches_applied_to ON patches(shop_id, applied_to, applied_at DESC);
```

- `applied_to`: e.g. `theme_block:trust:section_id`, `product:gid`.
- `version`: increment when we replace same logical target (rollback goes to previous version).

---

## 4. Experiments and results

### experiments

```sql
CREATE TABLE experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  target          TEXT NOT NULL,
  allocation      JSONB NOT NULL,
  variants        JSONB NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  primary_metric  TEXT NOT NULL DEFAULT 'purchase_rate',
  guardrails      JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_experiments_shop ON experiments(shop_id);
CREATE INDEX idx_experiments_shop_status ON experiments(shop_id, status);
CREATE INDEX idx_experiments_shop_started ON experiments(shop_id, started_at DESC);
```

- `target`: e.g. `product_page:cta`, `block:trust`.
- `allocation`: e.g. `{ "control": 0.5, "variant_a": 0.5 }`.
- `variants`: `{ "control": { "config": {} }, "variant_a": { "config": { "copy": "..." } } }`.
- `guardrails`: min_sample, max_duration_days, segment_guard (e.g. no rollout if mobile regresses).

### assignments

Persist assignment so same visitor gets same variant. Can be in Redis only for hot path; Postgres for durability and replay.

```sql
CREATE TABLE assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  experiment_id  UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  anon_id        TEXT NOT NULL,
  session_id     TEXT NOT NULL,
  variant        TEXT NOT NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, experiment_id, anon_id)
);

CREATE INDEX idx_assignments_lookup ON assignments(shop_id, experiment_id, anon_id);
CREATE INDEX idx_assignments_experiment ON assignments(experiment_id, variant);
```

### results_aggregates

Pre-aggregated per experiment/variant/segment (and optionally time window). Refreshed by worker.

```sql
CREATE TABLE results_aggregates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  experiment_id  UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant        TEXT NOT NULL,
  segment        TEXT,
  visitors       INT NOT NULL DEFAULT 0,
  views          INT NOT NULL DEFAULT 0,
  add_to_cart    INT NOT NULL DEFAULT 0,
  begin_checkout INT NOT NULL DEFAULT 0,
  purchase       INT NOT NULL DEFAULT 0,
  revenue        DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, experiment_id, variant, COALESCE(segment, ''))
);

CREATE INDEX idx_results_aggregates_experiment ON results_aggregates(experiment_id, variant);
```

Optional: add `posterior` or `credible_interval` JSONB for Bayesian stats cached per variant.

---

## 5. Migration strategy

- Use TypeORM migrations (or plain SQL in `apps/backend/src/migrations/`).
- First migration: create all tables and indexes.
- Partitioning: either create initial partitions in migration or a startup job that ensures current + next month exist.
- No FK from `events` to `shops` if we partition (can add check constraint or application-level integrity). Alternatively keep `events` non-partitioned with FK and partition later when volume demands; for v1 we can start non-partitioned and add partitioning in a follow-up migration.

Simplified v1 (no partitioning) if we want to ship faster:

```sql
-- Same events table without PARTITION BY; add partitioning later
CREATE TABLE events (
  id           BIGSERIAL PRIMARY KEY,
  shop_id      UUID NOT NULL,
  anon_id      TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  props        JSONB NOT NULL DEFAULT '{}',
  product_id   TEXT,
  experiment_id TEXT,
  variant      TEXT
);
CREATE INDEX idx_events_shop_ts ON events(shop_id, ts);
CREATE INDEX idx_events_shop_type_ts ON events(shop_id, event_type, ts);
CREATE INDEX idx_events_experiment ON events(shop_id, experiment_id, variant, ts) WHERE experiment_id IS NOT NULL;
```

Then retention is enforced by `DELETE FROM events WHERE ts < now() - interval '90 days'` (or per-shop setting) until we move to partitioning + drop old partitions.
