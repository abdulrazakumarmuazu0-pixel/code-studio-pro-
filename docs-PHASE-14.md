# Phase 14 — Production Observability + Reliability

This phase adds operational visibility and safer asynchronous deployment processing.

## Included
- Prometheus-compatible `/metrics` endpoint.
- Detailed database readiness endpoint at `/health/detailed`.
- HTTP request counters and latency histograms.
- Reliability events and dead-letter job persistence.
- Deployment queue leasing with stale-claim recovery.
- Exponential retry/backoff with a configurable maximum attempt count.
- Terminal deployment failures are persisted in a dead-letter queue.
- Worker error and deployment success/failure metrics.
- Prometheus scrape configuration.
- PostgreSQL backup script using `pg_dump` with SHA-256 sidecar.

## Production requirements
Metrics are intentionally dependency-light and process-local. For multiple API replicas, scrape every replica and aggregate in Prometheus. For durable counters, use a centralized metrics system rather than relying on in-memory process state.

Run migrations before starting API/workers:
`npm run migrate`

Start API:
`npm start`

Start deployment worker:
`npm run worker:deployments`

Example backup:
`DATABASE_URL='postgresql://...' BACKUP_DIR=/secure/backups ./scripts/ops/backup-postgres.sh`

## Recovery model
1. A queued deployment is atomically claimed with `SKIP LOCKED`.
2. Claims expire after `DEPLOYMENT_LEASE_TIMEOUT_MS` and are returned to the queue.
3. Failed deployments retry with exponential backoff.
4. After `DEPLOYMENT_MAX_ATTEMPTS`, the deployment becomes failed and a dead-letter record is created.
5. Operators should inspect `dead_letter_jobs` and `reliability_events` before replaying a job.

## Important limitation
This is an observability/reliability foundation, not a full managed monitoring product. Alert routing, long-term log aggregation, multi-region failover, managed object-storage backups, and automated disaster recovery still require deployment-specific infrastructure.
