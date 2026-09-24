# Phase 37 — Immutable Release Integrity

- Removed production image pull failure tolerance.
- Added post-pull image digest verification.
- Required `npm ci` and lockfiles in API/runtime-worker container builds.
- Added runtime-worker dependency installation to CI.
- Enabled BuildKit SBOM and provenance attestations for production images.
- Strengthened logout E2E to require HTTP 401/403 after session invalidation.
- Documented remaining genuine lockfile blocker.
