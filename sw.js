/* Garagem Viva · service worker */
const VERSION = 'gv-2026-10-02-1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const LIBS = /^https:\/\/(unpkg\.com\/leaflet@|cdn\.jsdelivr\.net\/npm\/(tesseract\.js@|tesseract\.js-core@|@tesseract\.js-data\/))/;
const TILES = /^https:\/\/server\.arcgisonline\.com\//;
const MAX_TILES = 400;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'gv-tiles' && k !== 'gv-libs').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trim(cacheName, max) {
  const c = await caches.open(cacheName); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // App page: network first (to receive updates), cache as fallback (offline)
  if (url.origin === location.origin && (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'))) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Other files of the app: cache first
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
    return;
  }
  // Map library and map tiles: stale-while-revalidate, so maps also work offline for visited areas
  if (LIBS.test(req.url) || TILES.test(req.url)) {
    const name = LIBS.test(req.url) ? 'gv-libs' : 'gv-tiles';
    e.respondWith(caches.open(name).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); if (name === 'gv-tiles') trim(name, MAX_TILES); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  // Everything else (fuel prices, geocoding, Google Maps) always goes to the network
});
