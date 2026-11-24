// Service Worker: macht die App offline nutzbar.
// Bei Änderungen an den Dateien VERSION erhöhen, damit die Geräte die neue Fassung laden.
const VERSION = 'v7';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/auth.js',
  './js/config.js',
  './js/db.js',
  './js/quotes.js',
  './js/stats.js',
  './js/sync.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL)
    .then(c => c.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'no-cache' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      // Nur eigene Caches aufräumen: Askesis (Caches mit „fit-“) liegt auf derselben Origin.
      if ((key.startsWith('shell-') || key.startsWith('runtime-')) && key !== SHELL && key !== RUNTIME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase-API nie cachen
  if (url.hostname.endsWith('.supabase.co')) return;

  // Schriften und CDN: einmal laden, dann aus dem Cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(RUNTIME).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Eigene Dateien: Netz zuerst (immer aktuell), offline aus dem Cache
  event.respondWith((async () => {
    try {
      // no-cache: immer beim Server nachfragen, damit nie alte und neue Dateien gemischt werden
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
      }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw new Error('offline');
    }
  })());
});
