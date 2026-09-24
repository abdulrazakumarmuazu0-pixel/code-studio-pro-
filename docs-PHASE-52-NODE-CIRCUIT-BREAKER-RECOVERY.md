# Phase 52 — Runtime Node Circuit Breaker Recovery

## Purpose
Prevent a quarantined runtime node from immediately returning to scheduling after a single healthy application report. Recovery is now hysteretic: the quarantine cooldown must expire and the worker must provide consecutive healthy heartbeats.

## Production behavior
- Node quarantine remains persisted in PostgreSQL.
- A healthy runtime report no longer clears node quarantine directly.
- After `RUNTIME_NODE_QUARANTINE_SECONDS`, each worker heartbeat increments `failover_recovery_streak`.
- The node is recovered only after `RUNTIME_NODE_RECOVERY_THRESHOLD` consecutive eligible heartbeats.
- Successful recovery resets the node failure streak and records `failover_last_recovered_at`.
- Scheduler continues to select only `status='ready'` nodes, so quarantined nodes remain excluded.

## Defaults
- Recovery threshold: 3 consecutive heartbeats.
- Quarantine cooldown: 300 seconds.

## Validation boundary
Source, migration, shell, and Compose validation can be performed without a live cluster. Real recovery behavior still requires a production-like multi-node Docker/PostgreSQL environment with real worker heartbeats.
