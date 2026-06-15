/* sw.js — network-first: always serve the latest when online, fall back to
   cache only when offline. (v1 was cache-first and could pin a stale build.) */
const CACHE = 'stationery-v2';
const SHELL = [
  './', './index.html', './styles.css', './config.js', './compute.js', './parse.js',
  './demo-data.js', './api.js', './app.js', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;                       // writes always hit network
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;                   // fonts + Apps Script API → network
  // network-first: prefer fresh, cache it, fall back to cache (then index.html) when offline
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigation' ? caches.match('./index.html') : undefined)))
  );
});
