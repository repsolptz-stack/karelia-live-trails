const CACHE_NAME = 'karelia-live-trails-v1';
const TILE_CACHE = 'karelia-map-tiles-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Картографические тайлы: cache-first с фоном в сеть
  if (url.hostname.includes('basemaps.cartocdn.com') || url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const netRes = await fetch(req);
          if (netRes && netRes.ok) {
            cache.put(req, netRes.clone());
          }
          return netRes;
        } catch (err) {
          return cached || new Response('', { status: 504, statusText: 'Offline tile unavailable' });
        }
      })
    );
    return;
  }

  // Основной интерфейс и статика: stale-while-revalidate / cache fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((netRes) => {
          if (netRes && netRes.ok && url.origin === self.location.origin) {
            const clone = netRes.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return netRes;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
