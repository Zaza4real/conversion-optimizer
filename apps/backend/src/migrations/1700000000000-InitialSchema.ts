import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shops (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain            TEXT NOT NULL UNIQUE,
        access_token_enc  BYTEA NOT NULL,
        scope             TEXT,
        plan              TEXT NOT NULL DEFAULT 'starter',
        installed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        settings          JSONB NOT NULL DEFAULT '{}',
        uninstalled_at    TIMESTAMPTZ
      );
      CREATE INDEX idx_shops_domain ON shops(domain);
      CREATE INDEX idx_shops_installed ON shops(installed_at) WHERE uninstalled_at IS NULL;
    `);

    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
      CREATE TABLE events (
        id            BIGSERIAL PRIMARY KEY,
        shop_id       UUID NOT NULL,
        anon_id       TEXT NOT NULL,
        session_id    TEXT NOT NULL,
        event_type    TEXT NOT NULL,
        ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
        props         JSONB NOT NULL DEFAULT '{}',
        product_id    TEXT,
        experiment_id TEXT,
        variant       TEXT
      );
      CREATE INDEX idx_events_shop_ts ON events(shop_id, ts);
      CREATE INDEX idx_events_shop_type_ts ON events(shop_id, event_type, ts);
      CREATE INDEX idx_events_experiment ON events(shop_id, experiment_id, variant, ts) WHERE experiment_id IS NOT NULL;
    `);

    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
      CREATE TABLE patches (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
        applied_to        TEXT NOT NULL,
        payload           JSONB NOT NULL,
        rollback_payload  JSONB NOT NULL,
        applied_by        TEXT NOT NULL DEFAULT 'merchant',
        applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        version           INT NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_patches_shop ON patches(shop_id);
      CREATE INDEX idx_patches_applied_to ON patches(shop_id, applied_to, applied_at DESC);
    `);

    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
      CREATE TABLE assignments (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        experiment_id  UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        anon_id        TEXT NOT NULL,
        session_id     TEXT NOT NULL,
        variant        TEXT NOT NULL,
        assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(shop_id, experiment_id, anon_id)
      );
      CREATE INDEX idx_assignments_lookup ON assignments(shop_id, experiment_id, anon_id);
      CREATE INDEX idx_assignments_experiment ON assignments(experiment_id, variant);
    `);

    await queryRunner.query(`
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
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX idx_results_aggregates_unique ON results_aggregates(shop_id, experiment_id, variant, COALESCE(segment, ''));
      CREATE INDEX idx_results_aggregates_experiment ON results_aggregates(experiment_id, variant);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS results_aggregates CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS assignments CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS experiments CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS patches CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS recommendations CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS events CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS orders_cache CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS products_cache CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS shops CASCADE');
  }
}
