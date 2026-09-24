# Phase 35 — Supply-Chain & Immutable Release Security

- Added immutable SHA-tag release security gate.
- Added production runtime network isolation enforcement at release time.
- Added tracked-source credential/private-key pattern scan.
- Added Compose validation to the security gate.
- Hardened post-deploy release-marker failure handling.
- Extended production E2E to verify logout/session invalidation.
- Documented the remaining API dependency-lockfile limitation and recommended supply-chain controls.
