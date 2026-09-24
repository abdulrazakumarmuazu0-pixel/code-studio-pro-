# Phase 44 — Workspace Storage Hard Quotas

- Added XFS project-quota host provisioning contract.
- Added per-deployment hard byte quota provisioning script.
- Runtime worker now requires XFS + project-quota storage in production.
- Runtime artifact paths moved under per-deployment quota roots.
- Worker refuses deployment when quota contract is absent or mismatched.
- Runtime worker Compose now uses an explicit host storage bind mount instead of an unbounded named volume.
- Added production storage quota release gate.
- Added Phase 44 documentation.

No synthetic quota mechanism or fake storage API was added.
