# Phase 42 — Runtime Resource & Abuse Protection

This phase hardens runtime containers against resource exhaustion and concurrent quota bypass.

## Enforced controls
- Per-container memory and CPU ceilings.
- Memory swap ceiling defaults to the memory ceiling (no implicit extra swap budget).
- PIDs limit.
- Small non-executable `/tmp` and `/run` tmpfs budgets.
- File descriptor limits.
- Bounded Docker JSON logs using `max-size`/`max-file`.
- Read-only root filesystem and read-only workspace source remain enabled.
- Atomic tenant runtime-slot reservation prevents concurrent starts from bypassing `max_active_runtimes`.
- Failed starts release their reserved slot; successful starts release it on stop.
- Migration 025 reconciles persisted active-runtime reservations from deployment state.

## Intentional limitation
Generic Docker storage quotas are not enabled because `StorageOpt.size` is backend/filesystem dependent. Writable runtime state is instead bounded through read-only rootfs and explicit tmpfs sizes. Production hosts should separately enforce node-level disk alerts and container runtime storage policies appropriate to their Docker storage driver.

## Verification
This phase is code/config validation only in the current build environment. A live Docker daemon and production PostgreSQL instance are required for full runtime enforcement testing.
