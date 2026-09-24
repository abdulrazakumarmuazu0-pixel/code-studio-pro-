# Phase 58 — Real Incident Management, Alert Deduplication, Escalation & On-Call Reliability

This phase adds a persistent incident system behind Alertmanager. Alerts are authenticated into the API, deduplicated by Alertmanager fingerprint, persisted in PostgreSQL, and escalated by a dedicated worker to a real on-call webhook.

## Production flow
1. Prometheus evaluates production rules.
2. Alertmanager groups/inhibits duplicate or lower-severity alerts.
3. Alertmanager sends authenticated webhook payloads to the incident ingestion endpoint.
4. PostgreSQL stores the incident and event history.
5. Repeated alerts update `occurrence_count` instead of creating duplicate open incidents.
6. Open critical/warning incidents receive scheduled escalation attempts.
7. The worker uses row locking (`FOR UPDATE SKIP LOCKED`) so multiple worker replicas do not double-send the same escalation.
8. Admin users can acknowledge or resolve incidents; acknowledgement stops automatic escalation.
9. Resolved alerts are persisted and remain auditable.

## Required production secrets
- `INCIDENT_WEBHOOK_URL_FILE`: real reachable API incident-ingestion URL.
- `INCIDENT_WEBHOOK_TOKEN_FILE`: bearer token accepted by the API ingestion endpoint.
- `ONCALL_WEBHOOK_URL_FILE`: real on-call/paging receiver URL.
- `ONCALL_WEBHOOK_TOKEN_FILE`: bearer token for the on-call receiver.

No placeholder or fake receiver is accepted by the production gate.

## Operational defaults
- Critical first escalation: 10 minutes.
- Warning first escalation: 30 minutes.
- Critical maximum escalation levels: 3.
- Warning maximum escalation levels: 2.
- Failed escalation retry: 5 minutes.

These are operational defaults, not contractual SLO commitments; production teams should set them to their actual on-call policy.
