// sw.js — Service worker for LiveBench Viz
// Strategy: network-first for app shell, cache-first for data JSONs.

const CACHE_NAME = 'livebench-__SW_VERSION__';
const DATA_URLS = [
	'/livebenchviz/benchmark_lb.json',
	'/livebenchviz/inference.json'
];

self.addEventListener('install', (event) => {
  // Precache data files only; app shell is always fetched fresh
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(DATA_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);
  const isData = DATA_URLS.some((u) => url.pathname === u);

  if (isData) {
    // Cache-first for data: serve cached copy immediately, refresh in background
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((res) => {
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    );
  } else {
    // Network-first for app shell: always get fresh JS/HTML/CSS, fall back to cache
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
