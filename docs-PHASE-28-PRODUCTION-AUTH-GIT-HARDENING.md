# Phase 28 — Production Auth & Git Hardening

## Completed in this phase
- Replaced the Account demo toast with a real authentication UI backed by `/v1/auth/*`.
- Added register/login/logout methods to `AuthClient`.
- Removed Git PAT and public CORS-proxy fields from browser settings.
- Removed browser-side Git credential persistence.
- Remote Git clone/pull/push now require the production workspace boundary instead of a public CORS proxy.
- Added explicit workspace selection state to `WorkspaceClient`.
- Removed the `local-simulation` terminal capability name; real command execution is cloud-workspace-only.

## Intentionally not marked complete
Remote Git is not considered production-complete until the selected workspace is wired to the server-side Git command API and verified end-to-end against GitHub/GitLab. The browser must never receive or persist provider credentials.

## Verification
- JavaScript syntax checks must pass.
- Search must return zero matches for `cors.isomorphic-git.org`, `gitToken`, and `Account panel (demo)` in application source.
- Authentication routes must be integration-tested against PostgreSQL.
