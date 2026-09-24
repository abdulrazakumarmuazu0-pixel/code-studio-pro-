# Phase 24 — Durable Object Storage & Distributed Deployment Artifacts

## What changed
- Added an S3-compatible object-storage adapter using AWS Signature V4 and native `fetch`.
- Deployment publication can use `STORAGE_MODE=s3`.
- Each deployment is stored under an immutable prefix containing deployment ID and artifact SHA-256.
- A JSON manifest is written for every published artifact.
- Deployment metadata now records storage mode, prefix, manifest, file count and byte count.
- Individual artifact file records are stored in PostgreSQL for audit and integrity checks.
- Local filesystem remains available for development and single-host deployments.

## Production contract
Set:
- `STORAGE_MODE=s3`
- `STORAGE_ENDPOINT` for AWS S3 or an S3-compatible provider
- `STORAGE_REGION`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `STORAGE_PATH_STYLE=true` when required by the provider

Never commit storage credentials. Use the production secret manager.

## Immutable layout
`<STORAGE_PREFIX>/<deployment-id>/<artifact-sha>/...`

This prevents a new deployment from overwriting a previous artifact and makes rollback references immutable.

## Remaining work
The current Nginx deployment edge still serves local published paths. A subsequent edge/storage phase should make the serving layer object-storage aware (CDN/object-store origin or synchronized edge cache) before local published volumes are removed from production workers.
