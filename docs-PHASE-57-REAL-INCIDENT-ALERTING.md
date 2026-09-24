# Phase 57 — Real Incident Alerting & Alertmanager Integration

This phase connects Prometheus runtime/SLO alerts to a real Alertmanager delivery path.

## Production path

Prometheus -> Alertmanager -> configured production webhook receiver.

The receiver URL is not stored in Git. It is mounted as the Docker secret
`/run/secrets/alertmanager_webhook_url` from `ALERTMANAGER_WEBHOOK_URL_FILE`.

## Safety properties

- No placeholder/fake webhook URL is accepted by the production gate.
- Alertmanager persists alert state in a dedicated volume.
- Critical, warning, and info alerts have different repeat intervals.
- Critical alerts inhibit matching warning alerts to reduce duplicate notifications.
- Resolved notifications are enabled.
- Prometheus explicitly targets Alertmanager at `alertmanager:9093`.

## Activation

1. Create a real secret file containing the production webhook URL.
2. Set `ALERTMANAGER_WEBHOOK_URL_FILE` to that file path.
3. Run `./scripts/security/runtime-alertmanager-gate.sh`.
4. Start the monitoring compose stack.
5. Verify Alertmanager `/api/v2/status` and the receiver's delivery logs in the production environment.

The repository does not claim live delivery verification because that requires the
real production receiver and monitoring network.
