# Phase 50 — Stateful Failover Node Exclusion

This phase prevents an automatic runtime recovery from immediately placing a failed deployment back on the same runtime node during its configured failover cooldown.

## Production behavior
- A failed assignment records `last_failed_node_id` and `last_failed_node_until`.
- Health-triggered failover, worker lease expiry, and node-drain migration all record the failed node.
- Scheduler excludes that node for the deployment while the exclusion window is active.
- A successful reschedule clears the exclusion state.
- Normal node capacity, storage, heartbeat, and assignment limits remain enforced.
- No mock/fake failover path is introduced.

## Operational requirement
The exclusion is stateful in PostgreSQL and therefore survives API/orchestrator restarts.

## Validation
The release gate verifies the migration and failover scheduler/controller integration. Live multi-node Docker/XFS/edge failover still requires real production-like infrastructure testing.
