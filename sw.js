// Service Worker – WNV SISP PWA
// ASL Mediocampidano – SISP

const CACHE_NAME = 'wnv-sisp-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

// Risorse esterne da cachare alla prima visita
const EXTERNAL = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

// Install: precache assets locali
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: pulisce cache vecchie
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first per assets locali, Network-first per tile OSM e Nominatim
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Tile OpenStreetMap: network-first con fallback cache
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Nominatim geocodifica: solo network (dati real-time)
  if (url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify([]), {headers: {'Content-Type': 'application/json'}})
    ));
    return;
  }

  // Leaflet CDN e assets locali: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback per la pagina principale
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
