// ⛳ Golf Tracker - Service Worker
// Version du cache - à incrémenter à chaque mise à jour
const CACHE_NAME = 'golf-tracker-v5';

// Fichiers à mettre en cache pour le mode hors-ligne
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
];

// Installation : mise en cache des assets
self.addEventListener('install', event => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Mise en cache des fichiers');
      // On essaie de cacher tout, même si certains CDN échouent
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Impossible de cacher:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => { console.log('[SW] Suppression ancien cache:', key); return caches.delete(key); })
      )
    ).then(() => self.clients.claim())
  );
});

// Interception des requêtes : Cache First, puis réseau
self.addEventListener('fetch', event => {
  // On ignore les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // On ne touche jamais aux appels Supabase (données live + auth)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Ressource en cache : on la retourne immédiatement
        // Et on met à jour le cache en arrière-plan (stale-while-revalidate)
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => {});
        return cached;
      }

      // Pas en cache : on va chercher sur le réseau
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => {
        // Hors-ligne et pas en cache : page de fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Message pour forcer la mise à jour
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
