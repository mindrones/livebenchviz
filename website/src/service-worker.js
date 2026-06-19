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

// 4. Periodic Sync & Update Check logic
async function checkForUpdates() {
  try {
    const basePath = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/'));
    const hashUrl = `${self.location.origin}${basePath}/data-hash.json?t=${Date.now()}`;
    const targetUrl = `${self.location.origin}${basePath}/`;

    const res = await fetch(hashUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = await res.json();

    const cache = await caches.open('livebench-notification-cache');
    const cachedResponse = await cache.match('data-hash-version');

    let isNew = false;
    if (cachedResponse) {
      const oldData = await cachedResponse.json();
      if (oldData.hash && oldData.hash !== latest.hash) {
        isNew = true;
      }
    } else {
      // First run: silently seed the cache
      await cache.put('data-hash-version', new Response(JSON.stringify(latest)));
      return;
    }

    // Update the cached version
    await cache.put('data-hash-version', new Response(JSON.stringify(latest)));

    if (isNew) {
      self.registration.showNotification('LLM Benchmark Dashboard Updated', {
        body: 'New benchmark data has been added! Tap to view the latest scores.',
        icon: `${basePath}/icon-192x192.png`,
        badge: `${basePath}/favicon.ico`,
        tag: 'livebench-data-update',
        data: { url: targetUrl }
      });
    }
  } catch (err) {
    console.error('Error checking for updates in background:', err);
  }
}

// Listen for Periodic Background Sync trigger
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-check') {
    event.waitUntil(checkForUpdates());
  }
});

// Handle notification click (focus existing tab or open new tab)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/livebenchviz/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Allow manual trigger from client page for debugging
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
    event.waitUntil(checkForUpdates());
  }
});

