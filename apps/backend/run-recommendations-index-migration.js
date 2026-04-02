#!/usr/bin/env node
/**
 * One-off script to create the recommendations (shop_id, created_at) index.
 * Run with: DATABASE_URL=your_postgres_url node run-recommendations-index-migration.js
 * Or from repo root: cd apps/backend && node run-recommendations-index-migration.js
 */
const { Client } = require('pg');

const sql = `
  CREATE INDEX IF NOT EXISTS "IDX_recommendations_shop_created"
  ON recommendations (shop_id, created_at DESC);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL (e.g. from Railway Postgres → Variables).');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Index IDX_recommendations_shop_created created (or already exists).');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
