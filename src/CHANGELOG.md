## Phase 11 — Production Runtime Reliability
- Added runtime health checks and readiness gating.
- Added automatic restart reconciliation with bounded restart attempts.
- Added runtime logs endpoint and restart metadata.
- Hardened rollback route ownership authorization.

# Code Studio Pro — Production Improvements

## 2.1.0

- Restores the last saved project automatically after startup.
- Protects the active Monaco model during autosave, tab switching, preview, and page unload.
- Resolves local CSS and JavaScript assets relative to nested HTML files, including `..` paths.
- Adds a real responsive/device preview mode instead of the previous placeholder action.
- Fixes ZIP import path handling so root archives and single-folder archives import correctly.
- Adds system-theme resolution and applies theme settings immediately.
- Makes sidebar and bottom-panel event handling explicit and reliable.
- Adds a working Workbox configuration for `npm run build:pwa`.
- Removes the unused Tailwind runtime CDN from production HTML.

## Validation

- JavaScript syntax checks pass for application and service-worker sources.
- `npm run build:pwa` completes successfully and generates the service worker bundle.
- Browser smoke test confirms the application boots, the editor initializes, and device preview toggles.

## Phase 04 — Cloud Workspace Runtime
- Added Docker-backed workspace runtime adapter.
- Added authenticated workspace start/runtime/exec/stop/remove endpoints.
- Added constrained Node 22 workspace image with Git, Bash and Python tooling.
- Added staging Docker Compose wiring and workspace runtime documentation.
- Extended frontend WorkspaceClient with runtime operations.

## Phase 07
- Added GitHub OAuth integration foundation.
- Added encrypted GitHub token storage.
- Added repository listing and workspace Git operations.
- Added Git operation audit records and documentation.

## Phase 08
- Added build and deployment control plane.
- Added server-side build execution and deployment APIs.

## Phase 09 — Real Static Deployment Infrastructure
- Added deployment artifact extraction, immutable publication, checksums, and size metadata.
- Added queued deployment worker and deployment event audit trail.
- Added stable project deployment aliases and rollback support.
- Added Nginx deployment edge and production Docker Compose services.
- Added frontend deployment polling and rollback client methods.

## Phase 16 — Usage Metering + Plan Enforcement
- Added centralized plan entitlement and quota enforcement.
- Added project, workspace, deployment, custom-domain and runtime-hour limits.
- Added billing usage endpoint and frontend client support.
- Added subscription expiry fallback to Free plan.
- Added runtime-hour usage metering on runtime stop/reaper.

## Phase 17 — Admin & Operations Control Center
- Added role-aware admin/support authentication and operations APIs.
- Added user status and plan administration, overview metrics, payments/deployments monitoring, audit trail, and dead-letter resolution.

- Phase 18: Admin security hardening, granular permissions, CSRF protection, and admin client security.

## Phase 20 — Automated CI/CD + Production Release Pipeline
- Added GitHub Actions validation/build/release workflow.
- Added immutable SHA-tagged production images for API/workspace/runtime.
- Added production deployment and post-deploy health-check scripts.
- Added API syntax validation command.
- Added production compose image overrides and Phase 20 documentation.

## Phase 21 — Production Infrastructure & Release Safety
- Added release management migration and event schema.
- Added PostgreSQL advisory locking for serialized schema migrations.
- Added production preflight validation and deployment locking.
- Added health-gated deployment and immutable-image rollback tooling.
- Added optional release marker verification and production infrastructure documentation.

- Phase 23: multi-server production infrastructure foundation, API replicas, worker separation, and rollout contracts.

## Phase 25
- Added global deployment edge and public static deployment serving.
- Added object-storage/CDN public URL resolution and immutable cache policy.
- Added deployment manifest endpoint and global Nginx edge config.

## Phase 26 — Distributed Runtime Orchestration
- Added runtime node registry, heartbeat and capacity-aware scheduling.
- Added runtime assignment and orchestration event persistence.
- Added runtime-node admin operations and deployment scheduling APIs.
- Added production boundary documentation for the worker-agent stage.

## Phase 27 — Authenticated Runtime Worker Agent
- Added authenticated runtime worker registration and bearer credentials.
- Added worker heartbeat, assignment leasing and status reporting.
- Added standalone Docker runtime worker agent.
- Added S3 artifact materialization with checksum verification.
- Added distributed runtime execution mode.


## Phase 27.1 — Production Audit & Hardening
- Fixed auth route compatibility and orchestration authorization boundaries.
- Added atomic runtime capacity reservations and lease-generation fencing.
- Added runtime worker lease renewal and registration rate limiting.
- Added runtime-worker image to production CI/CD release manifests.
- Hardened PWA/Capacitor production metadata and removed temporary files.
