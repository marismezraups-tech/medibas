// Service worker: aplikācijas čaula bezsaistē + kartes flīžu kešs
const APP = 'medibas-app-v10', TILES = 'medibas-tiles-v1', MAX_TILES = 25000;
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.js', 'vendor/qrcode/qrcode.min.js', 'icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== TILES && k !== 'medibas-photos-v1').map(k => caches.delete(k)))).then(() => self.clients.claim())); });

const isTile = u => /tile\.opentopomap\.org|tile\.openstreetmap\.org|arcgisonline\.com|geoserver\.lvmgeo\.lv|lvmgeoserver\.lvm\.lv/.test(u);

self.addEventListener('fetch', e => {
  const req = e.request, url = req.url;
  if (req.method !== 'GET') return;
  // foto: kešs vispirms (nemainās), lai būtu redzami arī mežā bez zonas
  if (url.includes('/api/hunt/') && url.includes('/photo/')) {
    const key = url.replace(/[?&](id|t|k)=[^&]*/g, '');   // kešā bez atslēgām
    e.respondWith(caches.open('medibas-photos-v1').then(async c => {
      const hit = await c.match(key); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(key, res.clone()); return res;
    }).catch(() => new Response('', { status: 504 })));
    return;
  }
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
    if (res.ok && (url.startsWith(self.location.origin))) { const cl = res.clone(); caches.open(APP).then(c => c.put(req, cl)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});

let trimming = false;
async function trim(c) {
  if (trimming) return; trimming = true;
  try { const keys = await c.keys(); if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await c.delete(k); } finally { trimming = false; }
}

// Push paziņojumi no servera (SOS, trauksmes, medību statuss, torņa piešķiršana)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.some(c => c.visibilityState === 'visible' && c.focused)) return; // aplikācija ir atvērta — tā pati parāda
    return self.registration.showNotification(d.title || 'Medības', {
      body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'medibas', renotify: true,
      requireInteraction: !!d.urgent, vibrate: d.urgent ? [500, 200, 500, 200, 500] : [200], data: { hunt: d.hunt },
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const hunt = e.notification.data && e.notification.data.hunt;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./' + (hunt ? '#' + hunt : ''))));
});
