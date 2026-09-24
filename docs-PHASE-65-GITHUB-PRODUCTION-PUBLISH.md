# Phase 65 — Real GitHub Production Publish

Code Studio now provides a real server-side GitHub publishing path for authenticated users.

## Flow

1. User authenticates with GitHub through OAuth.
2. OAuth access token is encrypted at rest in PostgreSQL; it is never sent to browser JavaScript.
3. User selects a cloud workspace and chooses **Publish to GitHub**.
4. API creates a GitHub repository with `auto_init=false` (or reuses an existing empty repository owned by the connected account).
5. API uses the isolated workspace container and ephemeral `GITHUB_TOKEN` environment to initialize/configure Git, stage files, commit, and push `main`.
6. Git credentials are supplied through an in-process credential helper and are not written into the Git remote URL.
7. Browser receives repository metadata only after a successful push.

## Safety

- Repository names are validated server-side.
- Existing non-empty repositories are rejected by the publish flow.
- Workspace ownership is checked before any Git operation.
- GitHub access tokens remain server-side.
- `GIT_TERMINAL_PROMPT=0` prevents interactive credential prompts.
- Push is performed inside the isolated workspace runtime.
- Service Worker remains a frontend-origin concern; backend/API routes are not cached by the Service Worker.

## Required production configuration

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY`
- `WEB_ORIGIN`
- `DATABASE_URL`

The GitHub OAuth application redirect URI must exactly match `GITHUB_REDIRECT_URI`.

## Verification limitation

The implementation is syntax- and structure-validated in this build environment. A real GitHub OAuth authorization and push require the operator's GitHub account, OAuth application credentials, database, workspace runtime, and network access; those live credentials are intentionally not embedded in the repository.
