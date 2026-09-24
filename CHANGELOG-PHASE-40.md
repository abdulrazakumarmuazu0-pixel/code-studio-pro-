# Phase 40 — Docker Socket Least-Privilege & Runtime Worker Isolation

- Removed direct Docker socket access from runtime-worker.
- Added dedicated runtime-worker Docker socket proxy with least-privilege API flags.
- Added TCP Docker client support to runtime-worker.
- Reduced unnecessary Docker API capabilities on production and HA proxies.
- Added `scripts/security/docker-socket-boundary-gate.sh`.
- Added Phase 40 security documentation.
