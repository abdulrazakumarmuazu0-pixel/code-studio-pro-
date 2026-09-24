# Phase 46 — Multi-Node Runtime Storage & Scheduler Reliability

## Production changes

- Runtime nodes now advertise hard storage capacity in bytes.
- Scheduler accounts for CPU, memory, assignment count, and hard storage quota before selecting a node.
- Node storage usage is reconciled from authoritative runtime storage allocations before scheduling.
- Runtime worker registration and heartbeat report storage capacity/usage.
- Draining/offline nodes are excluded from new assignments.
- Active assignments on draining/offline nodes are released and requeued for placement on a ready node.
- Storage allocations are released during migration and capacity accounting is rebuilt safely.
- Production release fails closed when one node cannot accommodate at least one configured hard runtime quota.

## Safety boundaries

The scheduler never assumes that a storage quota is available merely because filesystem space exists. The runtime storage controller remains responsible for provisioning the XFS project quota; the worker starts only after the allocation contract is active.

## Live infrastructure requirement

Actual migration, XFS quota provisioning, node drain, and cross-node failover require a live multi-node Docker/XFS environment. Static validation does not claim those operations were exercised here.
