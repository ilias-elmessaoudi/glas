// Hält die App-Hülle offline bereit, damit sie vom Homescreen sofort startet.
const CACHE = 'glas-v1';
const HUELLE = ['./', 'index.html', 'style.css', 'app.js', 'spotify.js', 'config.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/herz.svg', 'icons/leer.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(HUELLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
// Erst Netz (neueste Version), bei Funkloch aus dem Speicher. Spotify-Anfragen nie zwischenspeichern.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const kopie = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, kopie));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
