# Phase 49 — Automatic Runtime Failover & Traffic Recovery

This phase adds production failover behavior for unhealthy runtimes and failed runtime nodes.

## Flow
1. Runtime Worker probes the real runtime HTTP endpoint.
2. Consecutive unhealthy probes increment `edge_unhealthy_streak`.
3. When the configured threshold is reached, the assignment is failed with `RUNTIME_HEALTH_UNHEALTHY` and its CPU/memory/storage reservations are released.
4. The orchestration reconciler detects failed assignments caused by node loss, worker lease expiry, node drain, or runtime health failure.
5. A cooldown and maximum recovery-attempt limit prevent hot-looping/flapping.
6. `scheduleDeployment()` selects a ready node with CPU, memory, storage, heartbeat and assignment capacity.
7. Storage allocation is recreated on the selected node.
8. Worker starts the real runtime and performs a fresh health probe.
9. Healthy assignments are exposed by the existing edge controller; unhealthy/failed assignments are excluded by the edge route query.

## Fail-closed
No fake endpoint, synthetic health response, or in-memory-only failover state is introduced. Live Docker/runtime, PostgreSQL, storage-controller and edge infrastructure remain required for production execution.

## Configuration
- `RUNTIME_HEALTH_FAILURE_THRESHOLD` default 3
- `RUNTIME_FAILOVER_COOLDOWN_SECONDS` default 30
- `RUNTIME_FAILOVER_MAX_ATTEMPTS` default 5

## Validation limitation
This environment does not contain a live multi-node Docker/XFS/edge cluster, so cross-node traffic recovery was statically validated but not claimed as live production-tested.
