# Phase 62 — Service Worker File-Origin / Sandbox Runtime Fix

## Problem

Code Studio was being opened directly from `file://`. The browser correctly rejected
`navigator.serviceWorker.register()` because Service Workers require a trustworthy HTTP(S)
origin (or a supported native runtime). This produced the visible console error:

`Failed to register a ServiceWorker: The URL protocol of the current origin ('file://') is not supported.`

A sandboxed iframe with an opaque origin can produce the same class of failure.

## Production fix

- `app.js` now performs an explicit origin capability check before registration.
- `file://` and opaque `null` origins fail closed without attempting registration.
- localhost HTTP is allowed for local development/testing.
- HTTPS is allowed for production PWA deployment.
- Supported Capacitor native runtimes remain eligible for native integration.
- Registration uses an explicit `./sw.js` scope.
- The Service Worker itself remains real; this is not a mock/offline simulation.
- Removed an accidentally duplicated custom runtime block from the generated `sw.js`.
- Removed the stale post-generation source-map reference from the manually hardened `sw.js`.

## Expected behavior

When launched from `file://`, Code Studio continues to work in local editor mode without a
false Service Worker registration error. When served from `https://` or localhost HTTP,
the real Service Worker registers normally.
