# Code Studio Pro

Production-oriented browser IDE / PWA with a real frontend, backend API, isolated workspace runtime, TypeScript language server, filesystem, terminal, GitHub OAuth/publish flow, secure preview sandbox, and Service Worker.

## Repository layout

- `src/` — frontend/PWA application, Monaco integration, workspace clients, filesystem, terminal, Git UI, Service Worker.
- `src/services/api/` — backend Fastify API, PostgreSQL migrations, authentication, GitHub OAuth, workspace/runtime control, deployment and operations workers.
- `src/services/workspace-image/` — isolated workspace image and TypeScript language server.
- `infrastructure/` — runtime, worker, storage controller, Docker and edge infrastructure.
- `infra/monitoring/` — Prometheus and Alertmanager configuration.
- `scripts/` — production security, release and verification gates.

## GitHub publish from Code Studio

The Source Control panel includes **Connect GitHub** and **Publish to GitHub**. The flow uses GitHub OAuth on the backend. Access tokens are encrypted in PostgreSQL and are never placed in browser storage or frontend source. Publishing creates a GitHub repository and pushes the current cloud workspace through the isolated workspace container.

Required backend variables:

```text
DATABASE_URL
WEB_ORIGIN
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI
TOKEN_ENCRYPTION_KEY
```

The GitHub OAuth application's callback URL must exactly match `GITHUB_REDIRECT_URI`.

## Service Worker

The PWA Service Worker is registered only from HTTP(S) origins. When opened directly as `file://`, Code Studio remains an editor but intentionally disables Service Worker registration because browsers do not permit Service Workers on `file://` origins.

## Production principle

No fake GitHub push, fake terminal, fake filesystem, or fake language-server completion is used in the production paths. Live OAuth, PostgreSQL, Docker workspace and GitHub credentials are deployment-time infrastructure and are intentionally not committed to the repository.
