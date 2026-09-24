# Code Studio Pro — Phase 17: Admin & Operations Control Center

Implemented an authenticated admin/support API foundation:
- role-aware sessions (`user`, `support`, `admin`)
- admin overview metrics
- user listing, suspension/activation
- manual plan assignment
- deployment and payment monitoring
- security/admin audit trail
- dead-letter queue inspection and resolution
- frontend `AdminClient`

Migration: `017_admin_operations.sql`

## Production requirements before public launch
- Bootstrap the first admin through a secure one-time CLI/database procedure; never expose public role elevation.
- Add MFA/WebAuthn, granular permissions, CSRF protection, pagination/filtering, and immutable audit retention.
- Add admin UI screens and approval workflows for destructive actions.
- Protect admin routes behind a separate admin origin/network policy and alerting.
