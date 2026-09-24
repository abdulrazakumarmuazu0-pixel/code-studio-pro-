# Code Studio Pro — Phase 18: Admin Security Hardening

Phase 18 hardens the Phase 17 operations control plane.

## Implemented
- Granular admin permissions: read, operate, billing, security.
- Support role is read-only for admin operations.
- Admin CSRF protection for state-changing admin requests.
- Short-lived strict CSRF cookie scoped to `/v1/admin`.
- Constant-time CSRF token comparison.
- Self-suspension protection.
- Admin security event schema foundation.
- Admin login timestamp tracking.
- Updated frontend `AdminClient` to obtain and send CSRF tokens.
- Existing admin APIs remain compatible for read operations.

## Permission model
- `support`: overview, users, deployments, payments, audit, dead letters (read-only).
- `admin`: all support permissions plus account status changes, plan changes, dead-letter resolution.

## Production next steps
- Complete WebAuthn/TOTP MFA enrollment and verification before privileged mutations.
- Add immutable audit retention/export and SIEM integration.
- Add dedicated admin origin/network controls.
- Add approval workflows for billing and destructive operations.
- Add automated security tests and end-to-end admin UI.
- Bootstrap the first administrator only through a one-time operator procedure.
