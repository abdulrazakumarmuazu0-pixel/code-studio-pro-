# Phase 45 — Automated Runtime Storage Controller

This phase adds a host-side privileged storage controller for lifecycle management of XFS project quotas.

## Flow
1. Runtime scheduling creates a `runtime_storage_allocations` row with a globally unique XFS project ID.
2. The storage controller polls the control plane using the runtime worker authentication token.
3. For `desired_state=active`, it creates the deployment directory, registers the XFS project mapping, applies the hard byte quota, and writes an atomic quota contract.
4. The runtime worker refuses to start until the allocation is `active` and the contract matches the deployment/project/quota.
5. When a runtime becomes terminal, the control plane changes the allocation to `released`.
6. The storage controller removes the project quota and deployment storage directory, then acknowledges `released`.
7. Reconciliation is idempotent and safe to repeat after controller or worker restarts.

## Security boundary
The controller is intentionally separate from the unprivileged runtime worker. It runs as root and requires `SYS_ADMIN` because XFS project quota management is a host/filesystem operation. The runtime worker does not receive this capability.

The controller shares only the worker token file and runtime storage root. It must be deployed on the same host/filesystem as the runtime worker.

## Production requirements
- XFS runtime storage mounted with `prjquota`/`pquota`.
- `/etc/projects` and `/etc/projid` writable by the controller.
- `STORAGE_CONTROLLER_IMAGE` must be an immutable release image.
- Controller and worker must use the same `RUNTIME_STORAGE_ROOT`.
- Controller must run only on dedicated runtime worker hosts.
- No fallback to soft quotas, `du`, or unbounded storage is permitted.

## Multi-node behavior
Storage allocation is node-scoped. If a deployment moves to another runtime node, the old node's allocation is marked `released` and the new node receives a new project ID. The old controller releases the old filesystem allocation independently.
