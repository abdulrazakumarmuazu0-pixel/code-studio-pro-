# Phase 63 — File-Origin Service Worker Hard Guard

- Added a call-site guard before any Service Worker registration attempt.
- `file://` and opaque `null` origins never invoke `navigator.serviceWorker`.
- Supported HTTP(S) origins continue to use the real Service Worker.
- File-origin editor mode remains functional without PWA registration.
- This is a runtime hardening fix, not a mock Service Worker.
