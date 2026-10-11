const CACHE_VERSION = 'gym-tracker-v4';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json', '/icons/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function cacheResponse(request, response) {
  if (response && response.status === 200) {
    const clone = response.clone();
    caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Never cache cross-origin requests — that includes every Supabase
  // API/auth call. Offline data is handled by the app's own snapshot.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first so new deploys show up, cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => cacheResponse('/index.html', response))
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Hashed build assets and static files: cache first.
  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => cacheResponse(request, response))
    )
  );
});
