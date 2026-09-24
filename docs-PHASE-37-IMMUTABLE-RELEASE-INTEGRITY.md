# Phase 37 — Immutable Release Integrity

This phase strengthens production release integrity without using fake infrastructure.

## Changes

- Production deployment no longer uses `--ignore-pull-failures`.
- Every release image must use an immutable `sha-<40 hex>` tag.
- After pull, deployment verifies every image exists locally and has a registry content digest.
- API and runtime-worker Docker builds now require committed lockfiles and use `npm ci`.
- Runtime-worker CI installs from its lockfile.
- Production container builds publish SBOM and provenance attestations through BuildKit.
- Production E2E logout verification requires an exact HTTP `401` or `403` response after logout.

## Remaining release blocker

The API and runtime-worker lockfiles must still be generated in a trusted network-enabled environment and committed. This phase does not synthesize lockfiles or claim dependency reproducibility before those files exist.
