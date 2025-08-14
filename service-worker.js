// Basic service worker for offline caching (assets + models on first use)
const CACHE_NAME = 'rag-pwa-v1';
const ASSETS = [
  '/', '/index.html', '/manifest.webmanifest',
  '/src/app.js', '/src/embeddings.js', '/src/rag.js', '/src/ui.css',
  '/assets/icon-192.png', '/assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Network-first for CDN models (they are big) with cache fallback
  const isModel = url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('esm.run') || url.hostname.includes('huggingface.co');
  if (isModel) {
    event.respondWith((async () => {
      try {
        const net = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, net.clone());
        return net;
      } catch {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      }
    })());
    return;
  }
  // Cache-first for app shell
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request)));
});
