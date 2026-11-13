// Service worker: aplikācijas čaula bezsaistē + kartes flīžu kešs
const APP = 'medibas-app-v4', TILES = 'medibas-tiles-v1', MAX_TILES = 4000;
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

const isTile = u => /tile\.opentopomap\.org|tile\.openstreetmap\.org|arcgisonline\.com|geoserver\.lvmgeo\.lv|lvmgeoserver\.lvm\.lv/.test(u);

self.addEventListener('fetch', e => {
  const req = e.request, url = req.url;
  if (req.method !== 'GET') return;
  if (url.includes('/api/') || url.includes('open-meteo.com')) return; // vienmēr tiešsaistē
  if (isTile(url)) {
    // kešs vispirms (flīzes reti mainās), tad tīkls
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(c); }
        return res;
      } catch (_) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  // aplikācijas faili: tīkls vispirms, rezervē kešs
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (url.startsWith(self.location.origin) || url.includes('unpkg.com') || url.includes('cdnjs.cloudflare.com'))) { const cl = res.clone(); caches.open(APP).then(c => c.put(req, cl)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});

let trimming = false;
async function trim(c) {
  if (trimming) return; trimming = true;
  try { const keys = await c.keys(); if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await c.delete(k); } finally { trimming = false; }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
