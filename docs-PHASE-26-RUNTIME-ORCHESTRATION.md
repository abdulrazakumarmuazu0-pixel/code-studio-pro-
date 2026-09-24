# Phase 26 — Distributed Runtime Orchestration

## Delivered
- Runtime node registry and heartbeat contract.
- Capacity-aware scheduler using CPU, memory, node health and assignment count.
- One active runtime assignment per deployment.
- Node draining control for operations.
- Runtime orchestration event trail.
- API endpoints for node registration/heartbeat, scheduling and assignment status.
- Stale-node detection and capacity rejection (`NO_RUNTIME_CAPACITY`).

## Production boundary
This phase is the orchestration control plane. It does **not** claim that containers can already be launched remotely on arbitrary nodes. A production runtime agent/worker must authenticate to the control plane, claim assignments, create the runtime locally, report status/health and release capacity on stop/failure.

## Next
Phase 27 should implement the authenticated runtime worker agent, lease/claim protocol, signed worker credentials, idempotent assignment execution, remote runtime health reporting, failover/rescheduling and capacity reconciliation.
