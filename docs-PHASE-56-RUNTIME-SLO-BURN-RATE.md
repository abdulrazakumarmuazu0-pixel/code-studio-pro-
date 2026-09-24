# Phase 56 — Runtime SLO Burn-Rate Enforcement

This phase adds production observability for runtime availability SLOs using authoritative PostgreSQL runtime state.

## SLO signal
The exporter exposes the ratio of running assignments whose latest edge health is healthy. No synthetic traffic or demo data is generated.

## Alerts
- Fast burn: error ratio > 1.44% for 5 minutes.
- Slow burn: error ratio > 0.6% for 30 minutes.
- No active sample: zero running assignments for 15 minutes.

The thresholds are operational defaults and should be reviewed against the service's contractual SLO before production activation.

## Gate
`scripts/security/runtime-slo-burn-rate-gate.sh` is invoked by the production deployment path and fails closed if the exporter, rules, or migration are missing.

Live Prometheus rule evaluation is not claimed by source-level validation; it requires a running production-like monitoring stack.
