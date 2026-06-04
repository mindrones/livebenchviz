// sw.js — Minimal cache-first service worker for LiveBench Viz
// Caches the app shell + data JSONs so the dashboard works offline.

const CACHE_NAME = 'livebench-v1';

// Assets that make the app shell (HTML, JS, CSS, fonts)
// and the two data files the dashboard needs to render.
const PRECACHE_URLS = [
  './',                           // index.html (adapter-static fallback)
  './benchmark_lb.json',          // benchmark scores
  './inference.json',              // model inference availability
];

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin, network-only for cross-origin
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests to our own origin
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      // Return cached version if available
      if (cached) return cached;

      // Otherwise fetch from network and cache a clone
      return fetch(request).then((response) => {
        // Don't cache non-OK or opaque responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});