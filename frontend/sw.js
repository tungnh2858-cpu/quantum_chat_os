const CACHE_NAME = 'edupulse-shell-v1';
const SHELL = ['index.html', 'assets/css/shared.css', 'assets/js/api.js', 'assets/js/layout.js', 'manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never cache API/websocket/uploads/published-project traffic - always go to network.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads') || url.pathname.startsWith('/p/') || url.pathname.startsWith('/ws')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => cached))
  );
});
