# Code Studio Pro — Phase 16: Usage Metering + Plan Enforcement

Phase 16 connects billing plans to real platform behavior. Plans are no longer informational records: project, workspace, deployment, custom-domain, and monthly runtime-hour limits are checked before protected resources are created or consumed.

## Included

- `016_usage_entitlements.sql` migration
- centralized `quota-service.js`
- plan entitlement lookup and billing-period refresh
- quota enforcement for projects
- quota enforcement for workspaces
- monthly deployment quota enforcement
- custom-domain quota enforcement
- monthly runtime-hour metering when runtimes stop
- `/v1/billing/usage` usage dashboard API
- frontend `BillingClient.getUsage()`
- expired subscription fallback to Free plan
- usage event storage foundation

## Quota response

Exceeded limits return HTTP `402` with:

```json
{
  "error": "QUOTA_EXCEEDED",
  "details": {
    "metric": "projects",
    "used": 1,
    "limit": 1,
    "upgrade_required": true
  }
}
```

## Runtime hours

Runtime usage is recorded when a runtime stops or is automatically reaped. For production billing, the worker should also checkpoint long-running runtimes periodically so a crash does not lose the final interval.

## Storage

The plan schema already exposes `storage_mb`, but Phase 16 intentionally does not fake byte-accurate storage accounting. A production implementation should meter actual persistent volume usage from the workspace/storage subsystem before enforcing that entitlement.

## Production requirements before public launch

- Paystack subscription lifecycle events should update renewals/cancellations from verified webhooks.
- Runtime-hour usage should be checkpointed periodically.
- Storage usage should be measured from persistent volumes/object storage.
- Usage writes should be idempotent where provider/workflow retries can occur.
- Billing/admin reconciliation jobs should run periodically.
