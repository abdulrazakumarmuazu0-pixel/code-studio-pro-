# Phase 54 — Runtime Circuit Breaker Enforcement

## Purpose
Make the Phase 51/52 node circuit breaker authoritative at every runtime admission boundary.

## Enforced boundaries
- Runtime deployment scheduler excludes nodes whose quarantine window is active.
- Runtime worker assignment claim excludes quarantined nodes, preventing already-queued work from being claimed by a quarantined worker.
- Runtime edge route reconciliation excludes quarantined nodes, preventing traffic from being published to a quarantined runtime node.

## Fail-closed rule
A node is schedulable/routable only when:
- `status = ready`
- heartbeat is fresh
- `failover_quarantined_until IS NULL OR failover_quarantined_until <= now()`

No mock or simulated recovery path is used.
