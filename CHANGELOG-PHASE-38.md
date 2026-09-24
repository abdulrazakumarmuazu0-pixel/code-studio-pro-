# Phase 38 — Strict Production Gates & Real Lockfile Bootstrap

- Added `scripts/release/bootstrap-lockfiles.sh` to generate API and runtime-worker npm lockfiles using the real registry only.
- The bootstrap script refuses synthetic/offline lockfiles and validates the resulting lockfiles through the reproducibility gate.
- Added `scripts/release/strict-production-gate.sh`.
- Production deploys now require explicit production E2E execution and backup-retention verification by default.
- Release-marker configuration is validated before deployment.
- Existing immutable image, SBOM/provenance and dependency gates remain enforced.

## Environment limitation

This build environment does not have npm registry access and therefore did not fabricate missing lockfiles. Run `./scripts/release/bootstrap-lockfiles.sh` from a trusted network-enabled environment, commit the resulting lockfiles, and rerun CI.
