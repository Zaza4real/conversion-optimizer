# Infra

- **env.example** — Copy to `.env` in repo root or in each app; fill Shopify and DB/Redis/S3.
- **docker-compose.yml** — Postgres 15 and Redis 7 for local dev. Run from repo root: `docker compose -f infra/docker-compose.yml up -d`.

IaC (Terraform/Pulumi) for prod: outline only in v1; define VPC, RDS/Postgres, ElastiCache/Redis, ECS or Lambda, S3, and secrets manager for ENCRYPTION_KEY and Shopify credentials.
