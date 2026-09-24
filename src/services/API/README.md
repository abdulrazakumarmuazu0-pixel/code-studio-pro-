# Code Studio Pro API

This directory contains the first runnable backend foundation. It uses Fastify, PostgreSQL, Argon2id password hashing, opaque HttpOnly sessions, rate limiting, CORS, and security headers.

## Local setup

```bash
cp .env.example .env
# Create the database named by DATABASE_URL, then:
npm install
npm run migrate
npm run dev
```

Required configuration is documented in `.env.example`. The API refuses to start without `DATABASE_URL`; it does not fall back to in-memory or fake data.

Health endpoints:

- `GET /health/live`
- `GET /health/ready`

Implemented endpoints:

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `POST /v1/auth/logout`
- `GET /v1/projects`
- `POST /v1/projects`

This is a foundation, not the complete platform. Workspace execution, GitHub OAuth, file storage, deployments, and workers still require implementation and infrastructure before their frontend capabilities can be enabled.
