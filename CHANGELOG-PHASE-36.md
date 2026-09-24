# Phase 36 — Reproducible Dependencies & Build Integrity

- Added `scripts/release/dependency-reproducibility-gate.sh`.
- CI now requires lockfiles and uses `npm ci` for the API.
- Production preflight invokes the same dependency gate.
- Removed mutable `latest` image publication from GitHub Actions.
- Added Phase 36 production documentation.
- Intentionally did not synthesize missing lockfiles because dependency resolution must be produced by a trusted registry-connected environment.
