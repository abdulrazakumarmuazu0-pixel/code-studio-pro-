# Phase 64 — Real Secure Preview Sandbox

## Production changes
- Removed `allow-same-origin` from preview iframes. User preview code remains script-capable but cannot become same-origin with the Code Studio editor through the sandboxed iframe.
- Added `referrerpolicy="no-referrer"` to preview iframes.
- Added a baseline CSP to generated local/blob previews.
- Added a baseline CSP/security-header boundary to the authenticated preview proxy.
- Preview proxy strips Code Studio `Authorization`, `Cookie`, `Host`, `Origin`, `Referer`, and internal preview token headers before forwarding to the workspace preview server.
- Preview proxy strips upstream `Set-Cookie` and upstream CSP before applying the platform-controlled preview policy.
- Added a production security gate.

## Verification boundary
Static syntax/security checks can be run in this build environment. A live browser multi-origin attack test and live workspace-container preview test require the production-like HTTP/Docker environment and are not claimed here.
