const CACHE_NAME = 'coyote-scorer-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/bootstrap.min.css',
  '/css/style.css',
  '/js/app.js',
  '/js/sync-manager.js',
  '/games/games.json',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching offline resources');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network first for API, Encode failure handling in App
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Cache First for static assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
