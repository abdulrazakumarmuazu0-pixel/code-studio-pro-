# Phase 39 — Runtime Worker Token Rotation & Zero-Downtime Security

## Implemented

- Runtime worker authentication now supports a short-lived previous-token grace window.
- Rotation atomically promotes the new token and retains the previous token for a bounded grace period.
- Worker token persistence uses write-to-temp + rename to avoid partially written credentials.
- Worker automatically rotates after `RUNTIME_WORKER_TOKEN_ROTATION_SECONDS`.
- If saving the new token fails after the server rotation, the old token remains temporarily valid, allowing recovery instead of locking out the worker.
- The rotation grace period is configurable with `RUNTIME_WORKER_TOKEN_ROTATION_GRACE_SECONDS` and bounded server-side.

## Required migration

Apply `024_runtime_worker_token_rotation_grace.sql` before enabling automatic rotation in production.

## Verification

The implementation was syntax-checked locally. A live PostgreSQL/Docker control-plane test was not performed in this environment because no configured production/staging stack was available.
