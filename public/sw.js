// Service worker mínimo: habilita la instalación como PWA en Android/Chrome.
// Los datos siempre se piden en vivo a Supabase; esto solo cachea el "shell" estático.
const CACHE = 'japtom-crm-v2';
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
  const url = new URL(event.request.url);

  // No interceptar peticiones a la API, ni nada que no sea GET
  // (crear usuario, bloquear, pagos, etc. deben ir siempre directo a la red).
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // network-first para el resto (páginas/archivos estáticos); si falla, intenta cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});