# Phase 29 — Production Workspace, Terminal & Runtime Hardening

## Completed
- Added a real cloud Projects client and production workspace bootstrap.
- Authenticated users can create/reuse a cloud project and workspace before remote Git or terminal use.
- Browser terminal commands now route to the authenticated workspace WebSocket instead of the legacy in-browser command interpreter whenever the production workspace API is configured.
- `npm` terminal commands execute in the real isolated workspace runtime rather than editing package manifests as a simulation.
- Workspace execution validates `cwd` and rejects paths outside `/workspace` or traversal attempts.
- Docker exec now passes controlled environment variables to the isolated workspace.
- Workspace network isolation is configurable through `WORKSPACE_NETWORK_INTERNAL` and is explicitly labeled.

## Production rule
No browser-side command execution is considered the production terminal. The browser is only a terminal client; command execution occurs in the authenticated workspace runtime.

## Remaining verification
- Run the API integration suite against PostgreSQL and Docker.
- Verify terminal WebSocket authentication and disconnect cleanup.
- Verify GitHub clone/push/pull end-to-end with a real OAuth connection.
- Verify workspace network policy on the deployed infrastructure.
