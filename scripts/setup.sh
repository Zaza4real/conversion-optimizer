#!/usr/bin/env bash
# Conversion Optimizer — local setup: start Postgres + Redis, run migrations.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/conversion_optimizer}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-dev_only_change_me_32_chars_minimum_xxxxxxxx}"

echo "=== Conversion Optimizer setup ==="

# 1) Start Postgres + Redis (Docker)
if command -v docker &>/dev/null; then
  echo "Starting Postgres and Redis with Docker..."
  docker compose -f infra/docker-compose.yml up -d
  echo "Waiting for Postgres to be ready..."
  for i in {1..30}; do
    if docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U postgres 2>/dev/null; then
      break
    fi
    sleep 1
  done
  sleep 2
else
  echo "Docker not found. Using existing Postgres and Redis."
  echo "  - Ensure Postgres is running and DATABASE_URL is correct in .env"
  echo "  - Ensure Redis is running on localhost:6379 (or set REDIS_URL)"
fi

# 2) Create DB if missing (when using Postgres without Docker)
echo "Ensuring database exists..."
(cd apps/backend && node scripts/create-db.js)

# 3) Run migrations
echo "Running database migrations..."
cd apps/backend
pnpm run migration:run
cd "$ROOT"

echo ""
echo "=== Setup complete ==="
echo "  Backend:  cd apps/backend && pnpm start:dev"
echo "  Admin:    cd apps/admin && pnpm dev  (use a tunnel for Shopify embedded app)"
echo "  Fill in  .env  with SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL from Partners."
echo ""
