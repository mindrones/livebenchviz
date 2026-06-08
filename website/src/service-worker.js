import { build, files, version } from '$service-worker';
import { DATA_VERSION } from './lib/data-version.js';

const CACHE_APP = `livebench-app-${version}`;
const CACHE_DATA = `livebench-data-${DATA_VERSION}`;

const DATA_URLS = files.filter(f => f.endsWith('.json'));
const APP_FILES = build.concat(files.filter(f => !f.endsWith('.json')));

// 1. Install phase: PRE-CACHE ONLY THE APP SHELL (JS, CSS, HTML).
// We do NOT pre-cache the large data JSON files here.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

// 2. Activate phase: Clean up ONLY the stale caches.
// If data didn't change, CACHE_DATA stays matching and is NOT deleted.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_APP && k !== CACHE_DATA)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 3. Fetch phase: Intercept and route to correct cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);
  const isData = DATA_URLS.some((u) => url.pathname === u);

  if (isData) {
    // Cache-first (stale-while-revalidate) for dataset JSONs
    event.respondWith(
      caches.open(CACHE_DATA).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((res) => {
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    );
  } else {
    // Cache-first / Fallback-to-network for app shell files
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
