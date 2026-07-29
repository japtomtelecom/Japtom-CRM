// Service worker mínimo: habilita la instalación como PWA en Android/Chrome.
// Los datos siempre se piden en vivo a Supabase; esto solo cachea el "shell" estático.
const CACHE = 'japtom-crm-v1';
const ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // network-first para todo; si falla (sin conexión) intenta servir del cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
