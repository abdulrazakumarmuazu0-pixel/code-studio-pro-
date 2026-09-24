# Phase 15 — Billing, Plans & Paystack

This phase adds a production-oriented billing control plane for Code Studio Pro.

## Included
- Free / Starter / Pro / Business plans
- PostgreSQL plan, subscription, transaction and webhook event tables
- Paystack transaction initialization and verification
- HMAC-SHA512 webhook signature verification
- Idempotent Paystack webhook event storage
- Payment-to-plan entitlement activation
- Billing status endpoint
- Frontend BillingClient
- Environment-based Paystack credentials

## Endpoints
- GET `/v1/billing/plans`
- GET `/v1/billing/me`
- POST `/v1/billing/initialize`
- GET `/v1/billing/verify/:reference`
- POST `/v1/billing/webhook/paystack`

## Important production requirements
- Keep `PAYSTACK_SECRET_KEY` server-side only.
- Use HTTPS for the Paystack callback/webhook in production.
- Configure webhook URL in Paystack dashboard.
- Do not trust client payment success; activate entitlements from verified provider responses/webhooks.
- Reconcile subscriptions periodically with provider state.
- Add actual quota enforcement to project/workspace/deployment routes before commercial launch.
- Amounts are stored in minor currency units (NGN kobo).
