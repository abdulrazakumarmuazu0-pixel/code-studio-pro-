# Code Studio Pro — Phase 13: Production Security & Multi-Tenant Isolation

## Implemented
- Tenant quotas for active runtimes, runtime memory and build capacity foundations.
- Security audit event storage and runtime lifecycle audit events.
- Suspended-account enforcement in authentication middleware.
- Runtime containers use read-only root filesystems, bounded tmpfs, dropped Linux capabilities, `no-new-privileges`, PID/CPU/RAM limits and file-descriptor limits.
- Configurable Docker endpoint abstraction supports a Docker Socket Proxy instead of mounting the Docker socket into API/worker containers.
- Production compose includes `tecnativa/docker-socket-proxy` and a runtime idle reaper.
- Runtime image healthcheck now performs an HTTP request rather than only testing a TCP connection.
- Runtime idle cleanup stops inactive runtimes after a configurable timeout.
- Custom hostname validation is strict and rejects local/suspicious hostnames.
- Runtime lifecycle actions are audit logged.

## Important production boundary
The Docker socket proxy reduces exposure but is not a complete security boundary by itself. Before public multi-tenant launch, isolate build/runtime workers onto dedicated nodes or a sandboxed container runtime, use a dedicated job queue, enforce egress policy, image signing/scanning, secret isolation, per-tenant storage quotas, and host-level monitoring.

## Required environment
- `DOCKER_HOST=tcp://docker-socket-proxy:2375` in production.
- `RUNTIME_IDLE_TIMEOUT_SECONDS` controls automatic idle shutdown.
- `RUNTIME_MEMORY_BYTES`, `RUNTIME_CPU_NANO`, `RUNTIME_PIDS_LIMIT` enforce per-runtime limits.

## Migration
Run `npm run migrate` before starting API/worker processes.
