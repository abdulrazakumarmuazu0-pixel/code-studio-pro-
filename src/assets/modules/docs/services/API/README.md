# Code Studio Pro API — Phase 03 foundation

This service is the production backend foundation for authentication, projects and cloud workspaces.

## Local setup

1. Install PostgreSQL 15+.
2. Create a database named `code_studio`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Run `npm install`.
5. Run `npm run migrate`.
6. Run `npm run dev`.

Health endpoints:
- `GET /health/live`
- `GET /health/ready`

API foundations:
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `POST /v1/auth/logout`
- `GET /v1/projects`
- `POST /v1/projects`
- `POST /v1/workspaces`
- `GET /v1/workspaces/:id`
- `POST /v1/workspaces/:id/stop`

This phase intentionally does **not** claim real container execution or deployment. Those require the workspace/execution and deployment services in later phases.
