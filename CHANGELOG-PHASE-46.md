# Phase 46 — Multi-Node Runtime Storage & Scheduler Reliability

- Added migration `028_runtime_storage_aware_scheduling.sql`.
- Added per-node storage capacity/usage accounting.
- Added storage-aware scheduler admission.
- Added draining/offline runtime migration and automatic requeue.
- Added storage capacity to worker registration/heartbeat.
- Added multi-node hard-storage production gate.
- Preserved fail-closed XFS project quota enforcement.
