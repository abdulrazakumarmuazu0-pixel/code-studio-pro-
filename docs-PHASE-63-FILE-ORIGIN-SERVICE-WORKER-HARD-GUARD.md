# Phase 63 — File-Origin Service Worker Hard Guard

The screenshot showed a Service Worker registration error while the application was running from `file://`. Phase 62 already contained an origin check inside the registration method, but this phase moves the protection to the initialization call site as well.

Expected behavior:
- `file://` => editor/local mode; no Service Worker API call.
- `http://localhost` => real Service Worker registration.
- `https://...` => real Service Worker registration.
- opaque/null origin => no registration.
