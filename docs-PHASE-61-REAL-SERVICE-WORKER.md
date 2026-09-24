# Phase 61 — Real Service Worker

The Code Studio PWA now uses a production service-worker runtime for the browser shell.

## Behavior

- Workbox remains responsible for generated precaching and static asset caching.
- Navigation preload is enabled.
- Same-origin navigation requests can fall back to the real cached `index.html` shell when offline.
- Authenticated API routes (`/api/*`, `/v1/*`) are explicitly excluded from browser caching.
- A waiting service worker can be activated through an explicit message.
- The application reloads after a real `controllerchange` so the new worker owns the page.
- Old Code Studio runtime page caches are removed during activation.

## Important production boundary

The service worker does not pretend to provide an offline backend. Workspace filesystem, terminal, Git, language-server, authentication, deployment, and other server-side operations still require the real backend/runtime unless a separate durable offline queue is deliberately implemented.
