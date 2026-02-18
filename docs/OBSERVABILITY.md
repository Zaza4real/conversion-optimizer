# Observability plan

## 1. Structured logs

- **Format:** JSON to stdout. Fields: `timestamp`, `level`, `message`, `service=backend`, `shop_id`, `request_id`, `job_id`, `duration_ms`, `error` (if any). No PII in logs (no anon_id in logs by default; only shop_id and request/job ids).
- **Levels:** error, warn, info, debug. LOG_LEVEL from env.
- **Where:** NestJS Logger with a custom transport that JSON-stringifies; or Pino with formatter. Every request: log at end with status, duration. Every job: log start and end (and failure with stack).

---

## 2. Traces

- **Scope:** Optional for v1. If we add OpenTelemetry: trace incoming HTTP (one span per request), and BullMQ job execution (one span per job). Span attributes: shop_id, job name, experiment_id where relevant.
- **Sampling:** 100% in dev; 10% or 1% in prod to limit cost. Errors always sampled.

---

## 3. Error reporting

- **Sentry:** Install @sentry/node. Capture unhandled exceptions and rejected promises. Breadcrumbs: last N log lines or HTTP requests. Set user context to shop_id (not domain or email). Release = git SHA or version from env.

---

## 4. Job metrics

- **Queues:** BullMQ exposes job counts (waiting, active, completed, failed). Export to a dashboard or log periodically (e.g. every 60s): queue name, counts. Alert if failed > threshold or waiting grows unbounded.
- **Critical jobs:** scan (per shop), experiment_aggregate, webhook handlers. Log duration and success/failure; on repeated failure alert.

---

## 5. Tracking gaps and alerting

- **Tracking health (per shop):** Ratio of product_view events to orders (or sessions to purchases) over last 7 days. If we have orders but almost no events, pixel may be broken or not installed. Store in cache or a small table `shop_health(shop_id, last_events_at, last_orders_at, event_order_ratio)`.
- **Dashboard:** “Tracking status” card: green if events in last 24h and ratio above threshold; yellow if low ratio; red if no events. Link to “Install pixel / check theme” docs.
- **Alerts:** (1) No events for shop in 48h (cron checks). (2) Experiment with >30% of purchases missing exposure (experiment quality warning already in UI; optionally email). (3) Webhook failure rate > 5% over 1h.

---

## 6. Dashboards (outline)

- **Operations:** Request rate, error rate, p99 latency; job queue depth; DB connection pool; Redis memory.
- **Product:** Shops installed, scans per day, recommendations generated, patches applied, experiments started, experiments with winner recommended.
- **Tracking:** Shops with no events in 24h; events per shop distribution; experiment exposure vs purchase attribution rate.

Use Grafana + Prometheus if we add metrics export; or rely on Sentry + log aggregation (e.g. Datadog, Logtail) and build dashboards there.
