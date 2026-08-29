// Bump this on every release so old (possibly stale) caches are deleted on activate.
const CACHE_NAME = 'quantum-chat-os-shell-v2';
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

  // Network-first for HTML/JS/CSS: code changes (like this one) must always reach the
  // browser on the very next load instead of being stuck behind a stale cached copy.
  // The cache is only used as an offline fallback, never as the primary source.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
