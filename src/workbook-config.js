module.exports = {
  globDirectory: '.',
  globPatterns: [
    '**/*.{html,js,css,json,png,jpg,jpeg,svg,ico,woff,woff2,ttf}'
  ],
  swDest: 'sw-generated.js',
  swSrc: 'sw.js',
  injectionPoint: 'self.__WB_MANIFEST',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'cdn-jsdelivr',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    },
    {
      urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'cdn-cloudflare',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60
        }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
        }
      }
    }
  ],
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true
};
