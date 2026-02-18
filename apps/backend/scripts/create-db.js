#!/usr/bin/env node
/**
 * Creates the conversion_optimizer database if it doesn't exist.
 * Run from apps/backend: node scripts/create-db.js
 * Uses DATABASE_URL from env; connects to postgres DB to create the target.
 */
const url = process.env.DATABASE_URL || 'postgresql://admin@localhost:5432/conversion_optimizer';
const targetDb = 'conversion_optimizer';
const baseUrl = url.replace(/\/[^/]*$/, '/postgres');

const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: baseUrl });
  await client.connect();
  const r = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [targetDb]
  );
  if (r.rows.length === 0) {
    await client.query(`CREATE DATABASE ${targetDb}`);
    console.log('Created database:', targetDb);
  } else {
    console.log('Database', targetDb, 'already exists');
  }
  await client.end();
}

main().catch((err) => {
  console.error('Create DB failed:', err.message);
  process.exit(1);
});
