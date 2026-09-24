module.exports = {
  globDirectory: '.',
  globPatterns: [
    '**/*.{html,js,css,json,webmanifest,png,svg,ico,woff2}'
  ],
  swDest: 'sw.js',
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/v1\//],
  navigationPreload: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'cdn-assets',
        expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    {
      urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'cdnjs-assets',
        expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'font-assets',
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 }
      }
    }
  ]
};
