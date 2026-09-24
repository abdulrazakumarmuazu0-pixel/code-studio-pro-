# Phase 09 — Real Static Deployment Infrastructure

## Implemented

- Immutable deployment artifact staging under `ARTIFACT_ROOT`.
- Docker workspace artifact extraction using the container archive API.
- SHA-256 manifest hash and artifact byte size.
- Atomic publication into `PUBLISHED_ROOT`.
- Deployment queue + dedicated deployment worker.
- Static publishing for `static`, Vite, React, Vue, Angular, and Next.js static export (`out`).
- Stable project alias at `/projects/<projectId>/` when a deployment belongs to a project.
- Deployment event audit records.
- Deployment rollback updates the stable project alias to a previous ready deployment.
- Nginx edge configuration for published deployment files.
- Production Docker Compose with API, deployment worker, and deployment edge.

## Explicit limitations

This phase is **not yet a complete multi-tenant public hosting platform**. Server-side Node/Next runtimes are intentionally rejected by the static publisher. HTTPS certificate automation, custom domains, per-tenant edge isolation, WAF/DDoS controls, object-storage replication, CDN, runtime containers, quotas, and zero-downtime orchestration remain later phases.

## Production requirements before public launch

1. Mount separate persistent storage for artifacts and published files.
2. Put the edge behind a real TLS reverse proxy/load balancer.
3. Do not expose the Docker socket to the public internet; move Docker control behind an isolated worker service.
4. Add storage quotas, deployment concurrency limits, retention policies, and backups.
5. Add CI tests for archive traversal, symlink handling, tenant isolation, and rollback correctness.
