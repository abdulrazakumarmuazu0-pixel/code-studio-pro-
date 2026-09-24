# Phase 51 — Runtime Node Failover Circuit Breaker

Production reliability hardening for repeated runtime health failures.

## Behavior
- Each runtime node tracks consecutive failover-triggering health failures.
- After `RUNTIME_NODE_QUARANTINE_THRESHOLD` failures, the node is quarantined for `RUNTIME_NODE_QUARANTINE_SECONDS`.
- Scheduler excludes quarantined nodes while preserving the existing per-deployment failed-node exclusion.
- A healthy runtime report resets the node failure streak and clears quarantine.
- Quarantine state is persisted in PostgreSQL and survives process restarts.
- No fake health state or simulated failover path is introduced.

## Defaults
- Threshold: 3
- Quarantine: 300 seconds

## Verification limitation
Live multi-node Docker/XFS/network failover must still be exercised in the target production-like cluster before launch. This phase validates source, migration, configuration, and release-gate contracts only.
