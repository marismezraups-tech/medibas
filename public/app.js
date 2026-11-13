/* Medības — komandas medību aplikācija (PWA)
 * Karte, dalībnieki reāllaikā, torņi ar šaušanas sektoriem, novērojumi, nomedītie dzīvnieki,
 * čats, SOS, medību zona, maršruta ieraksts, saule/mēness, vējš, eksports.
 */
'use strict';

/* ================= Palīgfunkcijas ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rad = Math.PI / 180;
const pad2 = n => String(n).padStart(2, '0');
const hhmm = d => d && !isNaN(d) ? pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '—';
const fmtTime = t => { const d = new Date(t); const now = new Date(); return (d.toDateString() === now.toDateString() ? '' : pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + ' ') + hhmm(d); };
const ago = t => { if (!t) return 'nav ziņu'; const s = Math.round((Date.now() - t) / 1000); if (s < 60) return s + ' s'; if (s < 3600) return Math.round(s / 60) + ' min'; return Math.round(s / 3600) + ' h'; };

function dist(a, b) { // metri
  const R = 6371000, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function bearing(a, b) {
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
function dest(p, brg, d) {
  const R = 6371000, δ = d / R, θ = brg * rad, φ1 = p.lat * rad, λ1 = p.lng * rad;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: φ2 / rad, lng: ((λ2 / rad + 540) % 360) - 180 };
}
const fmtDist = m => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km';
const DIRS = ['Z', 'ZZA', 'ZA', 'AZA', 'A', 'ADA', 'DA', 'DDA', 'D', 'DDR', 'DR', 'RDR', 'R', 'RZR', 'ZR', 'ZZR'];
const compass = b => DIRS[Math.round(b / 22.5) % 16];

function toast(msg, ms = 2500) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms); }
function vibrate(p) { if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (_) {} }

/* ================= Konstantes ================= */
const ROLES = { hunter: 'Mednieks', driver: 'Dzinējs', leader: 'Vadītājs', dog: 'Suns', observer: 'Novērotājs' };
const ROLE_ICON = { hunter: '', driver: '', leader: '★', dog: '🐕', observer: '' };
const TYPES = {
  stand:   { n: 'Tornis / stāvvieta', i: '🪜', c: '#c9a227' },
  obs:     { n: 'Novērojums',          i: '👁', c: '#3c8dde' },
  harvest: { n: 'Nomedīts',            i: '🎯', c: '#d83a3a' },
  shot:    { n: 'Šāviens',             i: '💥', c: '#ff7a1a' },
  blood:   { n: 'Asins / pēdas',       i: '🩸', c: '#8e1b1b' },
  dog:     { n: 'Suns rej / stāv',     i: '🐕', c: '#9b6b3c' },
  car:     { n: 'Auto / pulcēšanās',   i: '🚙', c: '#6c757d' },
  feed:    { n: 'Barotava',            i: '🌾', c: '#7aa33a' },
  cam:     { n: 'Meža kamera',         i: '📷', c: '#5a5aa8' },
  danger:  { n: 'Bīstami / neiet',     i: '⚠️', c: '#e0b400' },
  drive:   { n: 'Dzinēja līnija',      i: '➡️', c: '#e8541c' },
  other:   { n: 'Cits',                i: '📍', c: '#888' },
};
const SPECIES = ['Alnis', 'Staltbriedis', 'Stirna', 'Mežacūka', 'Dambriedis', 'Lapsa', 'Jenots', 'Vilks', 'Lūsis', 'Bebrs', 'Zaķis', 'Āpsis', 'Cits'];
const QUICK = ['Esmu vietā ✅', 'Sākam dzīt ▶', 'Dzīvnieks iet uz jums ⚠', 'Šāviens 💥', 'Trāpīts 🎯', 'Garām ✖', 'Suns pazudis 🐕', 'Vajadzīga palīdzība izvilkt', 'Dzinējs beidzies ⏹', 'Medības beigušās 🏁'];
const COLORS = ['#ff7a1a', '#3c8dde', '#5bd16b', '#e04f9a', '#ffd23f', '#9b59b6', '#1abc9c', '#e74c3c', '#f39c12', '#00bcd4'];

/* ================= Stāvoklis ================= */
const KEY = 'medibas_v1';
const S = {
  me: { id: uid(), name: '', role: 'hunter', color: COLORS[Math.floor(Math.random() * COLORS.length)] },
  hunt: null,               // {code, name, status}
  members: {}, markers: {}, chat: [], zone: [],
  journal: {},              // harvest/obs no visām medībām (paliek ierīcē)
  track: [], tracks: [],    // pašreizējais + saglabātie
  recording: false,
  outbox: [],
  unread: 0, lastSeenChat: 0,
  settings: { wake: false, scent: false, sectors: true, vibrate: true, compass: false, interval: 5, share: true, layer: 'topo', overlays: {}, power: true },
  weather: null,
};
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) { Object.assign(S, d); S.settings = Object.assign({ wake: false, scent: false, sectors: true, vibrate: true, compass: false, interval: 5, share: true, layer: 'topo', overlays: {}, power: true }, d.settings); } } catch (_) {}
  S.recording = S.recording && S.track.length > 0;
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { const { weather, ...rest } = S; localStorage.setItem(KEY, JSON.stringify(rest)); } catch (_) {} }, 300); }

/* ================= Sinhronizācija ================= */
const Sync = {
  server: false, es: null, connected: false,
  async probe() {
    try { const r = await fetch('api/ping', { cache: 'no-store' }); this.server = r.ok && (await r.json()).ok; } catch (_) { this.server = false; }
    $('#srvState').textContent = this.server ? 'pieejams' : 'nav (tikai lokāli)';
    // ja serveris vēl "mostas" vai nav sakaru — mēģina vēlreiz ik 15 s
    clearTimeout(this._retry);
    if (!this.server) this._retry = setTimeout(async () => { if (await this.probe()) { renderTeam(); if (S.hunt) this.connect(); } }, 15000);
    return this.server;
  },
  connect() {
    this.disconnect();
    if (!S.hunt || !this.server) return setConn();
    setConn('wait');
    const es = this.es = new EventSource('api/hunt/' + encodeURIComponent(S.hunt.code) + '/stream?id=' + S.me.id + '&k=' + encodeURIComponent(S.hunt.pass || ''));
    es.onopen = () => { this.connected = true; setConn('on'); this.flush(); pushMember(); Push.register(); };
    es.onerror = () => { this.connected = false; setConn('wait'); this.checkAccess(); };
    es.onmessage = e => { try { handle(JSON.parse(e.data), true); } catch (err) { console.warn(err); } };
  },
  disconnect() { if (this.es) this.es.close(); this.es = null; this.connected = false; },
  // Ja savienojums neizdodas — pārbauda, vai nav vajadzīga parole vai lietotājs izslēgts
  async checkAccess() {
    if (this._chk || !S.hunt || !this.server) return; this._chk = true;
    try {
      const r = await fetch('api/hunt/' + encodeURIComponent(S.hunt.code) + '?id=' + S.me.id + '&k=' + encodeURIComponent(S.hunt.pass || ''), { cache: 'no-store' });
      if (r.status === 403) this.denied((await r.json()).error);
    } catch (_) {}
    setTimeout(() => this._chk = false, 5000);
  },
  denied(why) {
    this.disconnect();
    if (why === 'banned') { const n = S.hunt.name; leaveHunt(true); toast('Medību vadītājs tevi izslēdza no medībām „' + n + '”', 6000); }
    else askPassword(S.hunt.code, S.hunt.pass ? 'Parole ir nomainīta vai nepareiza.' : 'Šīm medībām vajag paroli.');
  },
  send(type, payload) {
    const ev = { type, payload };
    handle(ev, false);
    if (!S.hunt) return;
    S.outbox.push(ev);
    // apvieno vecās pozīcijas — sūtām tikai jaunāko
    if (type === 'pos') S.outbox = S.outbox.filter((e, i, a) => e.type !== 'pos' || e === ev);
    save(); this.flush();
  },
  async flush() {
    if (!this.server || !S.hunt || !S.outbox.length || this._busy) return;
    this._busy = true;
    const batch = S.outbox.slice(0, 50);
    try {
      const r = await fetch('api/hunt/' + encodeURIComponent(S.hunt.code) + '/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.me.id, k: S.hunt.pass || '', events: batch }) });
      if (r.ok) { S.outbox = S.outbox.filter(e => !batch.includes(e)); save(); }
      else if (r.status === 403) { this._busy = false; return this.denied((await r.json()).error); }
    } catch (_) {}
    this._busy = false;
    if (S.outbox.length && this.connected) setTimeout(() => this.flush(), 1000);
  },
};
setInterval(() => Sync.flush(), 5000);

function setConn(state) {
  const dot = $('#connDot'), txt = $('#connText');
  dot.className = 'dot ' + (state || 'off');
  txt.textContent = !S.hunt ? 'Nav pievienots' : !Sync.server ? 'Lokālais režīms' : state === 'on' ? 'Tiešsaistē' : 'Savienojas…';
}

/* Notikumu apstrāde — gan lokāliem, gan no servera */
function handle(ev, remote) {
  const p = ev.payload || {};
  switch (ev.type) {
    case 'snapshot': {
      // Ja serveris ir restartēts (piem., bezmaksas hostings "aizmiga") un medību dati tur ir tukši,
      // bet šajā ierīcē tie ir — augšupielādē tos atpakaļ, lai komanda neko nezaudētu.
      const srvEmpty = !Object.keys(p.markers || {}).length && !(p.chat || []).length && !(p.zone || []).length;
      const localHas = Object.keys(S.markers).length || S.chat.length || S.zone.length;
      if (srvEmpty && localHas && S.hunt) {
        const seed = [{ type: 'hunt', payload: { name: S.hunt.name, status: S.hunt.status } }, ...Object.values(S.markers).map(m => ({ type: 'marker', payload: m }))];
        if (S.zone.length) seed.push({ type: 'zone', payload: { points: S.zone } });
        S.chat.slice(-100).forEach(c => seed.push({ type: 'chat', payload: c }));
        S.outbox = [...seed, ...S.outbox]; save(); setTimeout(() => Sync.flush(), 300);
        return;
      }
      S.members = p.members || {}; S.markers = p.markers || {}; S.zone = p.zone || [];
      // apvieno čatu (lai nepazūd nenosūtītās ziņas)
      const ids = new Set((p.chat || []).map(c => c.id));
      S.chat = [...(p.chat || []), ...S.chat.filter(c => !ids.has(c.id) && S.outbox.some(o => o.payload && o.payload.id === c.id))].sort((a, b) => a.t - b.t);
      if (S.hunt) {
        // servera noklusējuma nosaukums nepārraksta lokāli ievadīto
        if (p.name && p.name !== 'Medības ' + S.hunt.code) S.hunt.name = p.name;
        else if (p.name !== S.hunt.name) S.outbox.unshift({ type: 'hunt', payload: { name: S.hunt.name } });
        S.hunt.status = p.status || S.hunt.status;
        Object.assign(S.hunt, { owner: p.owner || '', hasPass: !!p.hasPass, start: p.start || '', meet: p.meet || '' });
      }
      S.trackers = p.trackers || {};
      // pārliek atpakaļ neapstiprinātās lokālās izmaiņas
      for (const o of S.outbox) if (o.type !== 'chat') handle(o, false);
      Object.values(S.markers).forEach(toJournal);
      renderAll(); break;
    }
    case 'pos': case 'member':
      S.members[p.id] = Object.assign(S.members[p.id] || {}, p);
      renderMember(p.id); throttleLists(); sectorsSoon(); break;
    case 'leave':
      delete S.members[p.id]; renderMember(p.id); throttleLists(); break;
    case 'marker': {
      const isNew = !S.markers[p.id];
      const prevAssigned = S.markers[p.id] && S.markers[p.id].assigned;
      if (remote && p.type === 'stand' && p.assigned === S.me.id && prevAssigned !== S.me.id && p.updatedBy !== S.me.id) {
        setTimeout(() => { toast('🪜 Tev piešķirts tornis ' + (p.name || '') + ' — atver to kartē', 6000); vibrate([200, 100, 200]); notify('Tev piešķirts tornis ' + (p.name || ''), 'stand'); }, 100);
      }
      S.markers[p.id] = p; renderMarker(p.id); toJournal(p); throttleLists();
      if (remote && isNew && p.by !== S.me.id && ['harvest', 'shot', 'danger', 'blood'].includes(p.type)) {
        toast(TYPES[p.type].i + ' ' + (p.byName || '') + ': ' + TYPES[p.type].n + (p.species ? ' — ' + p.species : '')); vibrate(200);
      }
      break;
    }
    case 'marker_del':
      sectorsSoon();
      delete S.markers[p.id]; renderMarker(p.id); throttleLists(); break;
    case 'chat':
      if (S.chat.some(c => c.id === p.id)) break;
      S.chat.push(p); S.chat.sort((a, b) => a.t - b.t); if (S.chat.length > 400) S.chat.splice(0, S.chat.length - 400);
      if (remote && p.from !== S.me.id) {
        if (current !== 'chat') { S.unread++; updateBadge(); }
        vibrate(p.kind === 'alert' ? [200, 100, 200] : 80);
        notify(p.name + ': ' + p.text, p.kind === 'alert' ? 'alert' : 'chat');
        if (current !== 'chat') toast('💬 ' + p.name + ': ' + p.text);
      }
      renderChat(); towerSoon(); break;
    case 'zone':
      S.zone = p.points || []; renderZone(); break;
    case 'sos':
      S.members[p.id] = Object.assign(S.members[p.id] || { id: p.id, name: p.name }, { sos: !!p.active, lat: p.lat, lng: p.lng, t: p.t, name: p.name || (S.members[p.id] || {}).name });
      renderMember(p.id); renderSOS(); throttleLists();
      if (remote && p.active && p.id !== S.me.id) { vibrate([500, 200, 500, 200, 500]); notify('🆘 SOS: ' + p.name, 'sos'); }
      break;
    case 'hunt':
      if (S.hunt) {
        if (p.name) S.hunt.name = p.name; if (p.status) S.hunt.status = p.status;
        for (const k of ['owner', 'start', 'meet']) if (p[k] != null) S.hunt[k] = p[k];
        if (p.hasPass != null) S.hunt.hasPass = p.hasPass;
        if ('pass' in p && !remote) S.hunt.pass = p.pass;   // īpašnieks iestatīja paroli
      }
      renderHeader(); renderTeam(); renderTower(); sectorsSoon(); break;
    case 'kicked':
      Sync.denied('banned'); break;
    case 'tracker':
      S.trackers = S.trackers || {}; S.trackers[p.dev] = p; renderTeam(); break;
    case 'tracker_del':
      if (S.trackers) delete S.trackers[p.dev]; delete S.members['trk-' + p.dev]; renderMember('trk-' + p.dev); renderTeam(); break;
  }
  save();
}

function toJournal(m) {
  if (!m || !['harvest', 'obs'].includes(m.type)) return;
  S.journal[m.id] = Object.assign({}, m, { hunt: S.hunt ? S.hunt.name : '' });
}

function notify(body, kind) {
  if (document.visibilityState === 'visible') return;
  if (S.pushOn && ['sos', 'alert', 'stand'].includes(kind)) return; // tos jau atsūta serveris kā push
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then(r => r.showNotification('Medības', { body, icon: 'icons/icon-192.png', tag: 'medibas', renotify: true })).catch(() => {});
  }
}

/* ================= Karte ================= */
let map, baseLayer, myMarker, myAcc, scentLayer, zoneLayer, trackLine, measureLayer;
const memLayers = {}, mkLayers = {}, sectorLayers = {};
/* LVM GEO WMS serveri. Galvenais — pašreizējais (tas pats, ko izmanto JOSM Latvijas kartēm);
 * rezerves — vecais publiskais GeoServer, ko LVM GEO dokumentācija norāda kā lvmgeoserver.lvm.lv. */
const LVM = 'https://geoserver.lvmgeo.lv/wms62531a9bfcfa4015856924e94076a178';
const LVM_VEC = 'https://geoserver.lvmgeo.lv/wmsvector62531a9bfcfa4015856924e94076a179';
const LVM_OLD = 'https://lvmgeoserver.lvm.lv/geoserver/ows';
const LVM_ATTR = '© <a href="https://www.lvmgeo.lv">LVM GEO</a>';
const lvm = (layers, oldLayers, extra) => Object.assign({ url: LVM, layers, fb: { url: LVM_OLD, layers: oldLayers }, format: 'image/vnd.jpeg-png8' }, extra || {});
const lvmVec = (layers, oldLayers) => ({ url: LVM_VEC, layers, fb: { url: LVM_OLD, layers: oldLayers }, format: 'image/png', transparent: true });

const LAYERS = {
  topo: { n: 'Topogrāfiskā (OpenTopoMap)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', o: { maxZoom: 17, subdomains: 'abc', attribution: '© OpenTopoMap, © OpenStreetMap' } },
  osm: { n: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', o: { maxZoom: 19, attribution: '© OpenStreetMap' } },
  lvmorto: { n: 'LVM ortofoto (2019–2022)', g: 'LVM GEO', wms: lvm('public:Orto_LKS', 'public:Orto_LKS'), o: { maxZoom: 20, maxNativeZoom: 19, attribution: LVM_ATTR + ', © LĢIA' } },
  lvmorto8: { n: 'LVM ortofoto, 8. cikls (2022–2024)', g: 'LVM GEO', wms: lvm('public:Orto_8cikls', 'public:Orto_LKS'), o: { maxZoom: 20, maxNativeZoom: 19, attribution: LVM_ATTR + ', © LĢIA' } },
  lvmtopo: { n: 'LĢIA topokarte 1:50 000', g: 'LVM GEO', wms: lvm('public:Topo50', 'public:Topo50', { format: 'image/png' }), o: { maxZoom: 18, attribution: LVM_ATTR + ', © LĢIA' } },
  lvmdtm: { n: 'Reljefa modelis (2022)', g: 'LVM GEO', wms: lvm('public:ZemeLKS2', 'public:ZemeLKS'), o: { maxZoom: 19, attribution: LVM_ATTR + ', © LĢIA' } },
  lvmtopo75: { n: 'Vēsturiskā topokarte 1:75 000 (1921–1940)', g: 'LVM GEO', wms: lvm('public:topo75LKS', 'public:topo75LKS', { format: 'image/png' }), o: { maxZoom: 16, attribution: LVM_ATTR } },
  sat: { n: 'Esri satelīts', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, attribution: '© Esri' } },
};
/* Pārklājumi — var ieslēgt vairākus vienlaikus virs jebkura fona */
const OVERLAYS = {
  cad: { n: 'Kadastra karte (zemes vienību robežas)', wms: lvmVec('Kadastra_karte', 'publicwfs:Kadastra_karte'), o: { minZoom: 13, maxZoom: 20, attribution: LVM_ATTR + ', © VZD' } },
  roads: { n: 'Adreses, ielas un ceļi', wms: lvmVec('Adreses_celu_tikls', 'publicwfs:Adreses_celu_tikls'), o: { minZoom: 12, maxZoom: 20, attribution: LVM_ATTR + ', © VZD' } },
  canopy: { n: 'Veģetācijas (koku) augstums', wms: lvm('public:CanopyHeightLKS', 'public:CanopyHeightLKS', { format: 'image/png', transparent: true }), o: { maxZoom: 19, opacity: .6, attribution: LVM_ATTR } },
  slope: { n: 'Reljefa slīpums', wms: lvm('public:SlopeLKS', 'public:SlopeLKS', { format: 'image/png', transparent: true }), o: { maxZoom: 19, opacity: .55, attribution: LVM_ATTR } },
  admin: { n: 'Administratīvās robežas', wms: lvmVec('LV_admin_vienibas', 'publicwfs:LV_admin_vienibas'), o: { minZoom: 7, maxZoom: 20, attribution: LVM_ATTR } },
};
const activeOverlays = {};

/* Izveido slāni; WMS slānim, ja galvenais serveris neatbild, automātiski pārslēdzas uz rezerves serveri */
function makeLayer(def, pane) {
  const base = Object.assign({}, def.o, pane ? { pane } : {});
  if (!def.wms) return L.tileLayer(def.url, base);
  const w = def.wms;
  const lyr = L.tileLayer.wms(w.url, Object.assign(base, { layers: w.layers, styles: '', format: w.format || 'image/png', transparent: !!w.transparent, version: '1.3.0' }));
  let ok = 0, bad = 0, switched = false;
  lyr.on('tileload', () => ok++);
  lyr.on('tileerror', () => {
    if (switched || ok > 0 || ++bad < 4 || !w.fb) return;
    switched = true;
    lyr.wmsParams.layers = w.fb.layers;
    if (w.fb.url === LVM_OLD && lyr.wmsParams.format === 'image/vnd.jpeg-png8') lyr.wmsParams.format = 'image/jpeg';
    lyr.setUrl(w.fb.url);
    console.warn('LVM: pārslēdzos uz rezerves serveri', w.fb.url, w.fb.layers);
  });
  return lyr;
}

function initMap() {
  map = L.map('map', { zoomControl: false, attributionControl: true, tap: true }).setView([56.95, 24.6], 8);
  L.control.scale({ imperial: false, position: 'topleft' }).addTo(map);
  map.createPane('overlayTiles'); map.getPane('overlayTiles').style.zIndex = 250; // virs fona, zem atzīmēm
  setLayer(S.settings.layer);
  Object.entries(S.settings.overlays || {}).forEach(([k, on]) => on && setOverlay(k, true));
  zoneLayer = L.layerGroup().addTo(map);
  measureLayer = L.layerGroup().addTo(map);
  scentLayer = L.layerGroup().addTo(map);
  trackLine = L.polyline([], { color: '#ff3df0', weight: 4, opacity: .85 }).addTo(map);
  map.on('click', onMapClick);
  map.on('dragstart', () => { if (follow) { follow = false; $('#btnFollow').classList.remove('on'); } });
}
function setLayer(k) {
  if (!LAYERS[k]) k = 'topo';
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = makeLayer(LAYERS[k]).addTo(map);
  baseLayer.bringToBack();
  S.settings.layer = k; save();
}
function setOverlay(k, on) {
  if (activeOverlays[k]) { map.removeLayer(activeOverlays[k]); delete activeOverlays[k]; }
  if (on && OVERLAYS[k]) activeOverlays[k] = makeLayer(OVERLAYS[k], 'overlayTiles').addTo(map);
  S.settings.overlays = Object.assign({}, S.settings.overlays, { [k]: !!on }); save();
}

function initials(n) { return (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

function memberIcon(m, isMe) {
  const stale = !isMe && Date.now() - (m.t || 0) > 120000;
  const hdg = (m.heading != null && !isNaN(m.heading)) ? `<div class="arr" style="transform:rotate(${m.heading}deg)"></div>` : '';
  const lbl = isMe ? 'Es' : esc(m.name || '?');
  return L.divIcon({
    className: '', iconSize: [34, 34], iconAnchor: [17, 17],
    html: `<div class="mem ${stale ? 'stale' : ''} ${m.sos ? 'sos' : ''} ${isMe ? 'me' : ''}">${hdg}<div class="c" style="background:${m.sos ? '#ff3030' : esc(m.color || '#ccc')}">${m.role === 'dog' ? '🐕' : esc(initials(m.name))}</div><div class="mk-lbl">${lbl}${ROLE_ICON[m.role] && m.role !== 'dog' ? ' ' + ROLE_ICON[m.role] : ''}</div></div>`,
  });
}

function renderMember(id) {
  if (!mapVisible()) { mapDirty = true; return; }
  const m = S.members[id];
  if (id === S.me.id) return renderMe();
  if (!m || m.lat == null) { if (memLayers[id]) { map.removeLayer(memLayers[id]); delete memLayers[id]; } return; }
  if (!memLayers[id]) {
    memLayers[id] = L.marker([m.lat, m.lng], { icon: memberIcon(m), zIndexOffset: 900 }).addTo(map);
    memLayers[id].on('click', () => memberSheet(id));
  } else { memLayers[id].setLatLng([m.lat, m.lng]).setIcon(memberIcon(m)); }
}
setInterval(() => Object.keys(memLayers).forEach(renderMember), 30000); // atjauno "novecojušo" stāvokli

function markerIcon(m) {
  const t = TYPES[m.type] || TYPES.other;
  let lbl = m.name || m.species || '';
  if (m.type === 'stand' && m.assigned && S.members[m.assigned]) lbl += (lbl ? ' · ' : '') + S.members[m.assigned].name;
  if (m.count > 1) lbl += ' ×' + m.count;
  return L.divIcon({ className: '', iconSize: [32, 32], iconAnchor: [16, 16], html: `<div style="position:relative"><div class="mk" style="background:${t.c}">${t.i}</div>${lbl ? `<div class="mk-lbl">${esc(lbl)}</div>` : ''}</div>` });
}

function renderMarker(id) {
  if (!mapVisible()) { mapDirty = true; return; }
  const m = S.markers[id];
  if (sectorLayers[id]) { map.removeLayer(sectorLayers[id]); delete sectorLayers[id]; }
  if (!m || m.type === 'drive') { if (mkLayers[id]) { map.removeLayer(mkLayers[id]); delete mkLayers[id]; } }
  if (!m) return;
  if (m.type === 'drive') { mkLayers[id] = driveLayer(m).addTo(map); return; }
  if (!mkLayers[id]) {
    mkLayers[id] = L.marker([m.lat, m.lng], { icon: markerIcon(m) }).addTo(map);
    mkLayers[id].on('click', () => markerSheet(id));
  } else mkLayers[id].setLatLng([m.lat, m.lng]).setIcon(markerIcon(m));
  if (m.type === 'stand' && S.settings.sectors && m.dir != null) {
    const pts = [[m.lat, m.lng]], arc = +m.arc || 90, r = +m.range || 250;
    for (let a = m.dir - arc / 2; a <= m.dir + arc / 2 + .01; a += Math.max(2, arc / 30)) { const d = dest(m, a, r); pts.push([d.lat, d.lng]); }
    const col = m.assigned && S.members[m.assigned] ? S.members[m.assigned].color : '#ffd23f';
    sectorLayers[id] = L.polygon(pts, { color: col, weight: 2, fillOpacity: .15, dashArray: '6 4', interactive: false }).addTo(map);
  }
}

/* Dzinēja līnija: raustīta līnija ar bultu galā un nosaukumu sākumā */
function driveLayer(m) {
  const pts = (m.pts && m.pts.length ? m.pts : [[m.lat, m.lng]]).map(p => [p[0], p[1]]);
  const g = L.layerGroup();
  const line = L.polyline(pts, { color: '#e8541c', weight: 5, opacity: .9, dashArray: '10 8' }).addTo(g);
  line.on('click', () => markerSheet(m.id));
  if (pts.length >= 2) {
    const a = { lat: pts[pts.length - 2][0], lng: pts[pts.length - 2][1] }, b = { lat: pts[pts.length - 1][0], lng: pts[pts.length - 1][1] };
    const brg = bearing(a, b), len = Math.min(60, Math.max(15, dist(a, b) / 3));
    const l = dest(b, brg + 150, len), r = dest(b, brg - 150, len);
    L.polygon([[b.lat, b.lng], [l.lat, l.lng], [r.lat, r.lng]], { color: '#e8541c', fillColor: '#e8541c', fillOpacity: 1, weight: 1 }).on('click', () => markerSheet(m.id)).addTo(g);
  }
  L.marker(pts[0], { icon: L.divIcon({ className: '', iconSize: [24, 24], iconAnchor: [12, 12], html: `<div style="position:relative"><div class="mk" style="width:24px;height:24px;font-size:12px;background:#e8541c">➡️</div><div class="mk-lbl" style="top:26px">${esc(m.name || 'Dzinējs')}</div></div>` }) }).on('click', () => markerSheet(m.id)).addTo(g);
  return g;
}

function renderZone() {
  if (!mapVisible()) { mapDirty = true; return; }
  zoneLayer.clearLayers();
  if (S.zone.length >= 2) {
    const ll = S.zone.map(p => [p[0], p[1]]);
    (S.zone.length >= 3 ? L.polygon(ll, { color: '#ff7a1a', weight: 3, fillOpacity: .05, interactive: false }) : L.polyline(ll, { color: '#ff7a1a', weight: 3 })).addTo(zoneLayer);
  }
  if (mode === 'zone') S.zone.forEach(p => L.circleMarker(p, { radius: 6, color: '#fff', fillColor: '#ff7a1a', fillOpacity: 1 }).addTo(zoneLayer));
  if (mode === 'drive' && drawPts.length) {
    L.polyline(drawPts, { color: '#e8541c', weight: 5, dashArray: '10 8' }).addTo(zoneLayer);
    drawPts.forEach(p => L.circleMarker(p, { radius: 6, color: '#fff', fillColor: '#e8541c', fillOpacity: 1 }).addTo(zoneLayer));
  }
}

function renderAllMap() {
  if (!mapVisible()) { mapDirty = true; return; }
  mapDirty = false;
  Object.keys(mkLayers).forEach(id => { if (!S.markers[id]) renderMarker(id); });
  Object.keys(S.markers).forEach(renderMarker);
  Object.keys(memLayers).forEach(id => { if (!S.members[id]) renderMember(id); });
  Object.keys(S.members).forEach(renderMember);
  renderZone(); renderMe();
  trackLine.setLatLngs(S.track.map(p => [p[0], p[1]]));
}

/* ================= Mana atrašanās vieta ================= */
let myPos = null, follow = true, firstFix = true, lastSent = { t: 0 }, compassHdg = null;
/* GPS pārvaldnieks ar automātisku taupīšanu:
 * "aktīvs"  — nepārtraukta augstas precizitātes sekošana (kad ej);
 * "taupīšana" — ja 2 min nekusties, GPS tiek izslēgts un ieslēgts tikai uz brīdi ik 60 s.
 * Tiklīdz pozīcija mainās vairāk par ~25 m (vai ieslēdz navigāciju / treku), atgriežas aktīvajā režīmā. */
const STILL_AFTER = 120000, STILL_POLL = 60000;
const Geo = {
  watchId: null, pollT: null, mode: 'off', anchor: null, anchorT: 0,
  err(err) { toast(err.code === 1 ? 'Atļauj piekļuvi atrašanās vietai, lai redzētu sevi kartē' : 'GPS signāls nav pieejams'); },
  native() { const C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.BackgroundGeolocation; },
  active() {
    clearInterval(this.pollT); this.pollT = null;
    const BG = this.native();
    if (BG) {
      // Īstā aplikācija (Capacitor): atrašanās vieta tiek sūtīta arī ar izslēgtu ekrānu
      if (!this.nativeId) BG.addWatcher({ backgroundMessage: 'Medības: tava atrašanās vieta tiek kopīgota ar komandu', backgroundTitle: 'Medības notiek', requestPermissions: true, stale: false, distanceFilter: 8 },
        (loc, err) => { if (err) return this.err({ code: err.code === 'NOT_AUTHORIZED' ? 1 : 2 }); onPos({ coords: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, heading: loc.bearing, speed: loc.speed } }); })
        .then(id => this.nativeId = id);
      if (this.mode !== 'active') { this.mode = 'active'; this.anchorT = Date.now(); renderPower(); }
      return;
    }
    if (this.watchId == null) this.watchId = navigator.geolocation.watchPosition(onPos, e => this.err(e), { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
    if (this.mode !== 'active') { this.mode = 'active'; this.anchorT = Date.now(); renderPower(); }
  },
  still() {
    if (this.native()) return;   // vietējais spraudnis pats taupa bateriju (distanceFilter)
    if (this.watchId != null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
    clearInterval(this.pollT);
    this.pollT = setInterval(() => navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 }), STILL_POLL);
    this.mode = 'still'; renderPower();
  },
  mustStayActive() { return !S.settings.power || S.recording || !!navTarget || mode === 'place' || mode === 'measure'; },
  check(p) {
    const moved = !this.anchor || dist(this.anchor, p) > Math.max(25, Math.min(p.acc, 80));
    if (moved) { this.anchor = { lat: p.lat, lng: p.lng }; this.anchorT = Date.now(); if (this.mode === 'still') this.active(); return; }
    if (this.mode === 'still' && this.mustStayActive()) return this.active();
    if (this.mode === 'active' && !this.mustStayActive() && Date.now() - this.anchorT > STILL_AFTER && p.acc < 60) this.still();
  },
  wake() { this.anchorT = Date.now(); if (this.mode === 'still') this.active(); },
};
function startGeo() {
  if (!navigator.geolocation) return toast('Šī ierīce neatbalsta GPS');
  Geo.active();
}
function renderPower() {
  const el = $('#powerText'); if (!el) return;
  el.textContent = Geo.mode === 'still' ? ' · 🔋 taupīšana' : '';
  renderTower();
}

/* Baterijas līmenis (Chrome/Android; iPhone to nenodod) — redz arī komanda */
let battery = null;
if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; b.addEventListener('levelchange', () => renderTower()); }).catch(() => {});
const batLevel = () => battery ? Math.round(battery.level * 100) : null;
function onPos(pos) {
  const c = pos.coords;
  const prev = myPos;
  myPos = { lat: c.latitude, lng: c.longitude, acc: c.accuracy, t: Date.now(), heading: (c.heading != null && !isNaN(c.heading) && c.speed > 0.5) ? c.heading : (prev ? prev.heading : null), speed: c.speed };
  renderMe();
  if (firstFix) { firstFix = false; map.setView([myPos.lat, myPos.lng], 15); loadWeather(); renderSun(); }
  else if (follow && mapVisible()) map.panTo([myPos.lat, myPos.lng], { animate: true });
  // treks
  if (S.recording && c.accuracy < 50) {
    const last = S.track[S.track.length - 1];
    if (!last || dist({ lat: last[0], lng: last[1] }, myPos) > 8) { S.track.push([myPos.lat, myPos.lng, Date.now()]); if (mapVisible()) trackLine.addLatLng([myPos.lat, myPos.lng]); else mapDirty = true; save(); updateTrackChip(); }
  }
  // sūtīšana komandai
  const due = Date.now() - lastSent.t > S.settings.interval * 1000;
  const moved = !lastSent.lat || dist(lastSent, myPos) > 10;
  if (S.hunt && S.settings.share && due && (moved || Date.now() - lastSent.t > 60000)) {
    lastSent = { t: Date.now(), lat: myPos.lat, lng: myPos.lng };
    pushMember(true);
  }
  updateInfoChip();
  Geo.check(myPos);
  towerSoon(); sectorsSoon();
}
function pushMember(withPos) {
  if (!S.hunt) return;
  const p = { id: S.me.id, name: S.me.name, role: S.me.role, color: S.me.color, t: Date.now() };
  if (S.settings.share && myPos) Object.assign(p, { lat: myPos.lat, lng: myPos.lng, acc: Math.round(myPos.acc), heading: myHeading() });
  if (batLevel() != null) p.bat = batLevel();
  Sync.send(withPos ? 'pos' : 'member', p);
}
function myHeading() { return S.settings.compass && compassHdg != null ? compassHdg : myPos && myPos.heading; }
function renderMe() {
  if (!myPos || !map) return;
  if (!mapVisible()) { mapDirty = true; return; }
  const me = Object.assign({}, S.me, myPos, { heading: myHeading(), sos: S.members[S.me.id]?.sos });
  if (!myMarker) {
    myAcc = L.circle([myPos.lat, myPos.lng], { radius: myPos.acc, color: '#ff7a1a', weight: 1, fillOpacity: .08, interactive: false }).addTo(map);
    myMarker = L.marker([myPos.lat, myPos.lng], { icon: memberIcon(me, true), zIndexOffset: 1000 }).addTo(map);
  } else { myMarker.setLatLng([myPos.lat, myPos.lng]).setIcon(memberIcon(me, true)); myAcc.setLatLng([myPos.lat, myPos.lng]).setRadius(myPos.acc); }
  renderScent();
}
function renderScent() {
  scentLayer.clearLayers();
  if (!S.settings.scent || !myPos || !S.weather) return;
  const to = (S.weather.dir + 180) % 360; // vējš pūš NO dir, smarža iet uz pretējo pusi
  const pts = [[myPos.lat, myPos.lng]];
  for (let a = to - 20; a <= to + 20; a += 4) { const d = dest(myPos, a, 400); pts.push([d.lat, d.lng]); }
  L.polygon(pts, { color: '#b0e0ff', weight: 1, fillColor: '#b0e0ff', fillOpacity: .18, interactive: false }).addTo(scentLayer);
}

let compassListening = false, compassAllowed = false;
function compassHandler(e) {
  const hd = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
  if (hd == null) return;
  const so = (screen.orientation && screen.orientation.angle) || 0;
  compassHdg = (hd + so + 360) % 360;
  if (!compassHandler._t) compassHandler._t = setTimeout(() => { compassHandler._t = null; renderMe(); }, 400);
}
function compassAdd() {
  if (compassListening) return;
  window.addEventListener('deviceorientationabsolute', compassHandler, true); window.addEventListener('deviceorientation', compassHandler, true);
  compassListening = true;
}
function compassRemove() {
  if (!compassListening) return;
  window.removeEventListener('deviceorientationabsolute', compassHandler, true); window.removeEventListener('deviceorientation', compassHandler, true);
  compassListening = false;
}
/* Pieprasa atļauju (iOS — tikai no pieskāriena) un ieslēdz */
function initCompass() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') { compassAllowed = true; compassSync(); } else toast('Kompasa atļauja liegta'); }).catch(() => {});
  } else { compassAllowed = true; compassSync(); }
}
/* Kompasa sensors darbojas tikai, kad karte ir redzama (taupa bateriju) */
function compassSync() { (S.settings.compass && compassAllowed && mapVisible()) ? compassAdd() : compassRemove(); }

/* ================= Režīmi (atzīme / mērīšana / zona) ================= */
let mode = null, measurePts = [], drawPts = [];
function setMode(m, text, btns) {
  mode = m;
  $('#modeBar').classList.toggle('hidden', !m);
  $('#crosshair').classList.toggle('hidden', m !== 'place');
  $('#btnAdd').classList.toggle('hidden', !!m);
  $('#btnMeasure').classList.toggle('on', m === 'measure');
  if (!m) { measureLayer.clearLayers(); measurePts = []; renderZone(); return; }
  $('#modeText').innerHTML = text;
  const box = $('#modeBtns'); box.innerHTML = '';
  (btns || []).forEach(([label, fn, cls]) => { const b = document.createElement('button'); b.className = 'btn sm ' + (cls || ''); b.textContent = label; b.onclick = fn; box.appendChild(b); });
}
function onMapClick(e) {
  const p = { lat: e.latlng.lat, lng: e.latlng.lng };
  if (mode === 'measure') {
    measurePts.push(p); drawMeasure();
  } else if (mode === 'zone') {
    S.zone.push([p.lat, p.lng]); renderZone();
  } else if (mode === 'drive') {
    drawPts.push([p.lat, p.lng]); renderZone();
  } else if (mode === 'place') {
    map.panTo(e.latlng);
  }
}
function drawMeasure() {
  measureLayer.clearLayers();
  const pts = (measurePts.length === 1 && myPos) ? [myPos, measurePts[0]] : measurePts;
  if (!pts.length) return;
  L.polyline(pts.map(p => [p.lat, p.lng]), { color: '#fff', weight: 3, dashArray: '6 6' }).addTo(measureLayer);
  pts.forEach(p => L.circleMarker([p.lat, p.lng], { radius: 5, color: '#000', fillColor: '#fff', fillOpacity: 1 }).addTo(measureLayer));
  let total = 0; for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  const last = pts.length > 1 ? bearing(pts[pts.length - 2], pts[pts.length - 1]) : null;
  $('#modeText').innerHTML = `📏 <b>${fmtDist(total)}</b>${last != null ? ` · virziens ${Math.round(last)}° (${compass(last)})` : ''}<br><span class="muted">${measurePts.length === 1 && myPos ? 'No manis līdz punktam. ' : ''}Pieskaries kartei, lai pievienotu punktus.</span>`;
}

/* ================= Apakšējā lapa ================= */
function openSheet(html, onMount) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').classList.remove('hidden'); $('#sheetBg').classList.remove('hidden');
  onMount && onMount($('#sheetBody'));
}
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheetBg').classList.add('hidden'); }
$('#sheetBg').onclick = closeSheet;

/* Atzīmes pievienošana / rediģēšana */
function startPlace(existing) {
  closeSheet();
  if (myPos && !existing) map.setView([myPos.lat, myPos.lng], Math.max(map.getZoom(), 15));
  if (existing) map.setView([existing.lat, existing.lng]);
  setMode('place', '📍 Pārvieto karti, lai krustiņš būtu vajadzīgajā vietā', [
    ['Šeit', () => { const c = map.getCenter(); setMode(null); markerForm(existing, { lat: c.lat, lng: c.lng }); }, 'primary'],
    ['Manā vietā', () => { if (!myPos) return toast('Nav GPS'); setMode(null); markerForm(existing, { lat: myPos.lat, lng: myPos.lng }); }],
    ['Atcelt', () => setMode(null)],
  ]);
}

function markerForm(existing, pos) {
  const m = Object.assign({ type: 'obs', count: 1, dir: null, arc: 90, range: 250, sex: '', age: '' }, existing || {}, pos || {});
  const memberOpts = Object.values(S.members).filter(x => x.name).map(x => `<option value="${esc(x.id)}" ${m.assigned === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const meOpt = !S.members[S.me.id] ? `<option value="${S.me.id}" ${m.assigned === S.me.id ? 'selected' : ''}>${esc(S.me.name)} (es)</option>` : '';
  openSheet(`
    <h2>${existing ? 'Labot atzīmi' : 'Jauna atzīme'}</h2>
    <div class="grid" id="fType">${Object.entries(TYPES).map(([k, t]) => `<button data-k="${k}" class="${m.type === k ? 'on' : ''}"><span>${t.i}</span>${t.n}</button>`).join('')}</div>
    <div id="fSpecies"><label>Suga</label><div class="chips">${SPECIES.map(s => `<button data-s="${s}" class="${m.species === s ? 'on' : ''}">${s}</button>`).join('')}</div></div>
    <div id="fCount"><label>Skaits<input id="fCnt" type="number" min="1" value="${m.count || 1}" inputmode="numeric"></label></div>
    <div id="fHarvest" class="two">
      <label>Dzimums<select id="fSex"><option value="">—</option><option ${m.sex === 'Tēviņš' ? 'selected' : ''}>Tēviņš</option><option ${m.sex === 'Mātīte' ? 'selected' : ''}>Mātīte</option></select></label>
      <label>Vecums<select id="fAge"><option value="">—</option><option ${m.age === 'Mazulis' ? 'selected' : ''}>Mazulis</option><option ${m.age === 'Jauns' ? 'selected' : ''}>Jauns</option><option ${m.age === 'Pieaudzis' ? 'selected' : ''}>Pieaudzis</option></select></label>
      <label>Svars, kg<input id="fWeight" type="number" inputmode="decimal" value="${esc(m.weight || '')}"></label>
      <label>Mednieks<input id="fHunter" value="${esc(m.hunter || S.me.name)}"></label>
    </div>
    <label id="fNameBox">Nosaukums / Nr.<input id="fName" value="${esc(m.name || '')}" placeholder="piem., T-7 vai 1. dzinējs"></label>
    <div id="fStand">
      <label>Piešķirts medniekam<select id="fAssign"><option value="">— brīvs —</option>${meOpt}${memberOpts}</select></label>
      <label>Šaušanas virziens: <b id="fDirV">${m.dir == null ? 'nav' : Math.round(m.dir) + '° ' + compass(m.dir)}</b>
        <input id="fDir" type="range" min="0" max="359" value="${m.dir ?? 0}"></label>
      <div class="row gap"><button class="btn sm" id="fDirPhone">🧭 Pēc telefona virziena</button><button class="btn sm" id="fDirNone">Bez sektora</button></div>
      <div class="two">
        <label>Sektora leņķis, °<input id="fArc" type="number" min="10" max="360" value="${m.arc}"></label>
        <label>Attālums, m<input id="fRange" type="number" min="20" max="2000" value="${m.range}"></label>
      </div>
    </div>
    <div id="fDrive" class="muted" style="font-size:13px">Pēc “Saglabāt” pieskaries kartei, lai iezīmētu dzinēja ceļu — pēdējais punkts būs bultas gals (virziens, kurā dzen).</div>
    <label>Piezīme<textarea id="fNote" rows="2">${esc(m.note || '')}</textarea></label>
    <div id="fPhotoBox">
      <label class="btn" style="display:inline-flex;align-items:center;gap:6px;color:var(--text);margin:4px 0">📷 ${m.photo ? 'Mainīt foto' : 'Pievienot foto'}<input id="fPhoto" type="file" accept="image/*" style="display:none"></label>
      <img id="fPhotoPrev" src="${m.photo || ''}" class="${m.photo ? '' : 'hidden'}" style="display:block;max-width:100%;max-height:180px;border-radius:10px;margin-top:6px">
    </div>
    <div class="muted" style="font-size:12px">📍 ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</div>
    <div class="row gap" style="margin-top:12px">
      <button class="btn primary grow" id="fSave">Saglabāt</button>
      ${existing ? '<button class="btn" id="fMove">Pārvietot</button>' : ''}
      <button class="btn" id="fCancel">Atcelt</button>
    </div>`, root => {
    const vis = () => {
      root.querySelector('#fSpecies').classList.toggle('hidden', !['obs', 'harvest', 'shot', 'blood', 'dog', 'cam'].includes(m.type));
      root.querySelector('#fCount').classList.toggle('hidden', m.type !== 'obs');
      root.querySelector('#fHarvest').classList.toggle('hidden', m.type !== 'harvest');
      root.querySelector('#fStand').classList.toggle('hidden', m.type !== 'stand');
      root.querySelector('#fNameBox').classList.toggle('hidden', !['stand', 'drive'].includes(m.type));
      root.querySelector('#fDrive').classList.toggle('hidden', m.type !== 'drive' || !!(m.pts && m.pts.length > 1));
      root.querySelector('#fPhotoBox').classList.toggle('hidden', ['drive', 'stand', 'car'].includes(m.type));
    };
    root.querySelector('#fPhoto').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { m.photo = await shrinkPhoto(f); const im = root.querySelector('#fPhotoPrev'); im.src = m.photo; im.classList.remove('hidden'); }
      catch (_) { toast('Foto neizdevās nolasīt'); }
    };
    vis();
    root.querySelector('#fType').onclick = e => { const b = e.target.closest('button'); if (!b) return; m.type = b.dataset.k; root.querySelectorAll('#fType button').forEach(x => x.classList.toggle('on', x === b)); vis(); };
    root.querySelector('#fSpecies').onclick = e => { const b = e.target.closest('button'); if (!b) return; m.species = m.species === b.dataset.s ? '' : b.dataset.s; root.querySelectorAll('#fSpecies button').forEach(x => x.classList.toggle('on', x.dataset.s === m.species)); };
    const dirV = () => root.querySelector('#fDirV').textContent = m.dir == null ? 'nav' : Math.round(m.dir) + '° ' + compass(m.dir);
    root.querySelector('#fDir').oninput = e => { m.dir = +e.target.value; dirV(); };
    root.querySelector('#fDirNone').onclick = () => { m.dir = null; dirV(); };
    root.querySelector('#fDirPhone').onclick = () => {
      if (!S.settings.compass) { S.settings.compass = true; $('#setCompass').checked = true; initCompass(); save(); }
      setTimeout(() => { const h = compassHdg ?? (myPos && myPos.heading); if (h == null) return toast('Kompass nav pieejams — izmanto slīdni'); m.dir = Math.round(h); root.querySelector('#fDir').value = m.dir; dirV(); }, 400);
    };
    root.querySelector('#fCancel').onclick = closeSheet;
    const mv = root.querySelector('#fMove'); if (mv) mv.onclick = () => startPlace(existing);
    root.querySelector('#fSave').onclick = () => {
      const out = {
        id: m.id || uid(), type: m.type, lat: m.lat, lng: m.lng, note: root.querySelector('#fNote').value.trim(),
        by: m.by || S.me.id, byName: m.byName || S.me.name, t: m.t || Date.now(), updated: Date.now(), updatedBy: S.me.id,
      };
      if (m.photo && !['drive', 'stand', 'car'].includes(m.type)) out.photo = m.photo;
      if (m.type === 'drive') {
        out.name = (root.querySelector('#fName').value || '').trim() || m.name || '';
        if (m.pts && m.pts.length > 1) { out.pts = m.pts; Sync.send('marker', out); closeSheet(); return toast('Saglabāts'); }
        closeSheet(); return startDrive(out);
      }
      if (['obs', 'harvest', 'shot', 'blood', 'dog', 'cam'].includes(m.type) && m.species) out.species = m.species;
      if (m.type === 'obs') out.count = Math.max(1, +root.querySelector('#fCnt').value || 1);
      if (m.type === 'harvest') Object.assign(out, { sex: root.querySelector('#fSex').value, age: root.querySelector('#fAge').value, weight: root.querySelector('#fWeight').value, hunter: root.querySelector('#fHunter').value.trim() });
      if (m.type === 'stand') Object.assign(out, { name: root.querySelector('#fName').value.trim(), assigned: root.querySelector('#fAssign').value, dir: m.dir, arc: +root.querySelector('#fArc').value || 90, range: +root.querySelector('#fRange').value || 250 });
      Sync.send('marker', out);
      if (!existing && ['harvest', 'shot'].includes(out.type) && S.hunt) {
        sendChat(`${TYPES[out.type].i} ${TYPES[out.type].n}${out.species ? ': ' + out.species : ''}${out.hunter ? ' (' + out.hunter + ')' : ''}`, 'alert', { lat: out.lat, lng: out.lng });
      }
      closeSheet(); toast('Saglabāts');
    };
  });
}

function startDrive(base) {
  showView('map');
  drawPts = [[base.lat, base.lng]];
  setMode('drive', '➡️ Pieskaries kartei, lai iezīmētu dzinēja ceļu. Pēdējais punkts = virziens, kurā dzen.', [
    ['Atsaukt', () => { if (drawPts.length > 1) drawPts.pop(); renderZone(); }],
    ['Gatavs', () => {
      if (drawPts.length < 2) return toast('Vajag vismaz 2 punktus');
      const out = Object.assign({}, base, { pts: drawPts.slice(), lat: drawPts[0][0], lng: drawPts[0][1] });
      drawPts = []; setMode(null); Sync.send('marker', out);
      if (S.hunt) sendChat(`➡️ Dzinējs ${out.name || ''}: ${fmtDist(trackLen(out.pts.map(p => [p[0], p[1], 0])))} uz ${compass(bearing({ lat: out.pts[out.pts.length - 2][0], lng: out.pts[out.pts.length - 2][1] }, { lat: out.pts[out.pts.length - 1][0], lng: out.pts[out.pts.length - 1][1] }))}`, 'normal', { lat: out.lat, lng: out.lng });
    }, 'primary'],
    ['Atcelt', () => { drawPts = []; setMode(null); }],
  ]);
  renderZone();
}
/* Foto samazināšana līdz ~1024 px JPEG (~100 KB), lai ātri sinhronizētos arī vājā mobilajā tīklā */
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject; img.src = url;
  });
}

function markerSheet(id) {
  const m = S.markers[id]; if (!m) return;
  const t = TYPES[m.type] || TYPES.other;
  const d = myPos ? `${fmtDist(dist(myPos, m))} · ${Math.round(bearing(myPos, m))}° ${compass(bearing(myPos, m))}` : '';
  const rows = [
    m.species && ['Suga', m.species + (m.count > 1 ? ' ×' + m.count : '')],
    m.name && ['Nosaukums', m.name],
    m.type === 'stand' && ['Mednieks', m.assigned && S.members[m.assigned] ? S.members[m.assigned].name : (m.assigned === S.me.id ? S.me.name : 'brīvs')],
    m.type === 'stand' && m.dir != null && ['Sektors', `${Math.round(m.dir)}° ${compass(m.dir)}, ${m.arc}°, ${m.range} m`],
    m.sex && ['Dzimums', m.sex], m.age && ['Vecums', m.age], m.weight && ['Svars', m.weight + ' kg'], m.hunter && ['Mednieks', m.hunter],
    m.note && ['Piezīme', m.note],
    ['Pievienoja', (m.byName || '?') + ', ' + fmtTime(m.t)],
    d && ['No manis', d],
  ].filter(Boolean);
  if (m.type === 'drive' && m.pts && m.pts.length > 1) rows.splice(1, 0, ['Garums', fmtDist(trackLen(m.pts.map(p => [p[0], p[1], 0])))]);
  openSheet(`<h2>${t.i} ${t.n}</h2><div class="kv">${rows.map(r => `<b>${r[0]}</b><span>${esc(r[1])}</span>`).join('')}</div>
    ${m.photo ? `<img src="${m.photo}" style="width:100%;border-radius:12px;margin-bottom:10px">` : ''}
    <div class="row gap">
      ${m.type === 'stand' ? '<button class="btn primary" id="sTake">Ieņemt šo torni</button>' : ''}
      <button class="btn" id="sNav">🧭 Vadīt uz šejieni</button>
      <button class="btn" id="sEdit">Labot</button>
      <button class="btn danger" id="sDel">Dzēst</button>
    </div>`, root => {
    root.querySelector('#sEdit').onclick = () => markerForm(m);
    root.querySelector('#sNav').onclick = () => { closeSheet(); navigateTo(m, t.i + ' ' + (m.name || m.species || t.n)); };
    root.querySelector('#sDel').onclick = () => {
      const b = root.querySelector('#sDel');
      if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Tiešām dzēst?'; return; }
      Sync.send('marker_del', { id }); closeSheet();
    };
    const tk = root.querySelector('#sTake'); if (tk) tk.onclick = () => {
      Object.values(S.markers).filter(x => x.type === 'stand' && x.assigned === S.me.id && x.id !== id).forEach(x => Sync.send('marker', Object.assign({}, x, { assigned: '' })));
      Sync.send('marker', Object.assign({}, m, { assigned: S.me.id, updated: Date.now(), updatedBy: S.me.id }));
      if (S.hunt) sendChat(`Esmu tornī ${m.name || ''} ✅`, 'normal', { lat: m.lat, lng: m.lng });
      closeSheet();
    };
  });
}

function memberSheet(id) {
  const m = S.members[id]; if (!m) return;
  const d = myPos && m.lat != null ? `${fmtDist(dist(myPos, m))} · ${Math.round(bearing(myPos, m))}° ${compass(bearing(myPos, m))}` : '—';
  openSheet(`<h2>${esc(m.name)} ${m.sos ? '🆘' : ''}</h2><div class="kv">
    <b>Loma</b><span>${ROLES[m.role] || '—'}</span><b>Pēdējās ziņas</b><span>${ago(m.t)} atpakaļ</span>
    <b>Precizitāte</b><span>${m.acc ? '±' + m.acc + ' m' : '—'}</span><b>Baterija</b><span>${m.bat != null ? m.bat + '%' : 'nav zināms'}</span><b>No manis</b><span>${d}</span></div>
    <div class="row gap"><button class="btn primary" id="mNav">🧭 Vadīt uz</button><button class="btn" id="mCenter">Rādīt kartē</button>
    ${isOwner() && id !== S.me.id && !m.tracker ? '<button class="btn danger" id="mKick">Izslēgt no medībām</button>' : ''}</div>`, root => {
    const kb = root.querySelector('#mKick');
    if (kb) kb.onclick = () => { if (!kb.dataset.ok) { kb.dataset.ok = 1; kb.textContent = 'Tiešām izslēgt?'; return; } Sync.send('kick', { id }); delete S.members[id]; renderMember(id); closeSheet(); toast(m.name + ' izslēgts. Ja vajag, nomaini arī medību paroli.'); };
    root.querySelector('#mNav').onclick = () => { closeSheet(); navigateTo(m, m.name, id); };
    root.querySelector('#mCenter').onclick = () => { closeSheet(); showView('map'); if (m.lat != null) map.setView([m.lat, m.lng], 16); };
  });
}

/* Navigācija uz punktu (attālums un virziens reāllaikā) */
let navTarget = null, navLine = null;
function navigateTo(p, label, memberId) {
  showView('map');
  navTarget = { lat: p.lat, lng: p.lng, label, memberId };
  Geo.wake();
  updateInfoChip();
  map.fitBounds(L.latLngBounds([[p.lat, p.lng], myPos ? [myPos.lat, myPos.lng] : [p.lat, p.lng]]).pad(.3), { maxZoom: 17 });
  follow = false; $('#btnFollow').classList.remove('on');
}
function updateInfoChip() {
  const chip = $('#infoChip');
  if (navTarget && navTarget.memberId && S.members[navTarget.memberId]) Object.assign(navTarget, { lat: S.members[navTarget.memberId].lat, lng: S.members[navTarget.memberId].lng });
  if (navLine) { map.removeLayer(navLine); navLine = null; }
  if (navTarget && myPos) {
    const d = dist(myPos, navTarget), b = bearing(myPos, navTarget);
    navLine = L.polyline([[myPos.lat, myPos.lng], [navTarget.lat, navTarget.lng]], { color: '#ffd23f', weight: 3, dashArray: '2 8', interactive: false }).addTo(map);
    chip.innerHTML = `🧭 ${esc(navTarget.label)}: <b>${fmtDist(d)}</b> · ${Math.round(b)}° ${compass(b)} &nbsp;<a href="#" id="navX" style="color:#ff9a9a">✕</a>`;
    chip.classList.remove('hidden');
    $('#navX').onclick = e => { e.preventDefault(); navTarget = null; updateInfoChip(); };
  } else if (S.recording) updateTrackChip();
  else chip.classList.add('hidden');
}
function trackLen(tr) { let s = 0; for (let i = 1; i < tr.length; i++) s += dist({ lat: tr[i - 1][0], lng: tr[i - 1][1] }, { lat: tr[i][0], lng: tr[i][1] }); return s; }
function updateTrackChip() {
  if (navTarget) return;
  const chip = $('#infoChip');
  if (!S.recording) return chip.classList.add('hidden');
  const dur = S.track.length ? Math.round((Date.now() - S.track[0][2]) / 60000) : 0;
  chip.innerHTML = `⏺ Ieraksts: <b>${fmtDist(trackLen(S.track))}</b> · ${dur} min`;
  chip.classList.remove('hidden');
}

/* ================= Drošība: šaušanas sektori un pazuduši dalībnieki ================= */
function inSector(st, p) {
  if (st.dir == null || p.lat == null) return null;
  const d = dist(st, p); if (d > (+st.range || 250) + 30 || d < 3) return null;
  let diff = Math.abs(((bearing(st, p) - st.dir) % 360 + 540) % 360 - 180);
  return diff <= (+st.arc || 90) / 2 + 5 ? d : null;
}
const sectorAlerted = {};
function checkSectors() {
  if (!S.hunt || S.hunt.status !== 'active') { showSectorBanner([]); return; }
  const now = Date.now(), found = [];
  const fresh = m => m && m.lat != null && now - (m.t || 0) < 180000;
  const stands = Object.values(S.markers).filter(x => x.type === 'stand' && x.dir != null && x.assigned);
  for (const st of stands) {
    if (st.assigned === S.me.id) {
      // kāds cits ir manā sektorā
      for (const m of Object.values(S.members)) {
        if (m.id === S.me.id || !fresh(m)) continue;
        const d = inSector(st, m); if (d != null) found.push({ key: 'in-' + m.id, text: `⚠ ${m.name} ir TAVĀ šaušanas sektorā — ${fmtDist(d)} ${compass(bearing(st, m))}` });
      }
    } else if (myPos && Date.now() - myPos.t < 60000) {
      // es esmu kāda cita sektorā
      const d = inSector(st, myPos);
      const owner = S.members[st.assigned];
      if (d != null) found.push({ key: 'me-' + st.id, text: `⚠ Tu esi ${owner ? owner.name + ' (' + (st.name || 'tornis') + ')' : (st.name || 'torņa')} šaušanas sektorā — ${fmtDist(d)} no torņa` });
    }
  }
  for (const f of found) {
    if (!sectorAlerted[f.key] || now - sectorAlerted[f.key] > 60000) {
      sectorAlerted[f.key] = now; vibrate([600, 150, 600, 150, 600]); notify(f.text, 'sector');
    }
  }
  for (const k of Object.keys(sectorAlerted)) if (!found.some(f => f.key === k)) delete sectorAlerted[k];
  showSectorBanner(found);
}
let lastSector = [];
function showSectorBanner(found) {
  lastSector = found;
  const b = $('#sectorBanner');
  b.innerHTML = found.map(f => esc(f.text)).join('<br>');
  b.classList.toggle('hidden', !found.length);
  const tw = $('#twSector'); if (tw) { tw.innerHTML = b.innerHTML; tw.classList.toggle('hidden', !found.length); }
}
let secT; function sectorsSoon() { clearTimeout(secT); secT = setTimeout(checkSectors, 300); }
setInterval(checkSectors, 20000);

const missingAlerted = {};
function checkMissing() {
  if (!S.hunt || S.hunt.status !== 'active' || !(isOwner() || S.me.role === 'leader')) return;
  const now = Date.now();
  for (const m of Object.values(S.members)) {
    if (m.id === S.me.id || !m.name) continue;
    const silent = now - (m.t || 0);
    if (silent > 10 * 60000 && silent < 6 * 3600000) {
      if (!missingAlerted[m.id]) { missingAlerted[m.id] = 1; const txt = `📵 ${m.name} nav sūtījis atrašanās vietu ${Math.round(silent / 60000)} min${m.bat != null ? ' (baterija bija ' + m.bat + '%)' : ''}`; toast(txt, 8000); vibrate([300, 100, 300]); notify(txt, 'missing'); }
    } else delete missingAlerted[m.id];
  }
}
setInterval(checkMissing, 60000);

/* ================= SOS ================= */
function initSOS(b) {
  let t;
  const start = e => {
    e.preventDefault();
    if (S.members[S.me.id]?.sos) return cancelSOS();
    b.classList.add('hold');
    t = setTimeout(() => { b.classList.remove('hold'); sendSOS(); }, 2000);
  };
  const stop = () => { clearTimeout(t); b.classList.remove('hold'); };
  b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
function sendSOS() {
  vibrate([300, 100, 300]);
  if (!S.hunt) toast('SOS saglabāts lokāli — pievienojies medībām, lai komanda to redzētu');
  const p = { id: S.me.id, name: S.me.name, active: true, t: Date.now(), lat: myPos?.lat, lng: myPos?.lng };
  Sync.send('sos', p);
  sendChat('🆘 SOS! Vajadzīga palīdzība' + (myPos ? '' : ' (atrašanās vieta nav zināma)'), 'alert', myPos && { lat: myPos.lat, lng: myPos.lng });
  sosLabels();
}
function cancelSOS() {
  Sync.send('sos', { id: S.me.id, name: S.me.name, active: false, t: Date.now(), lat: myPos?.lat, lng: myPos?.lng });
  sendChat('SOS atcelts — viss kārtībā ✅', 'normal');
  setTimeout(sosLabels, 50);
}
function renderSOS() {
  const list = Object.values(S.members).filter(m => m.sos && m.id !== S.me.id);
  const bn = $('#sosBanner');
  towerSoon();
  if (!list.length) { bn.classList.add('hidden'); sosLabels(); return; }
  bn.innerHTML = '🆘 SOS: ' + list.map(m => `<a href="#" data-id="${esc(m.id)}" style="color:#fff">${esc(m.name)}${myPos && m.lat != null ? ' (' + fmtDist(dist(myPos, m)) + ')' : ''}</a>`).join(', ') + ' — pieskaries, lai vadītu';
  bn.classList.remove('hidden');
  bn.onclick = e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); const m = S.members[a.dataset.id]; if (m && m.lat != null) navigateTo(m, '🆘 ' + m.name, m.id); };
  sosLabels();
}
function sosLabels() { const on = S.members[S.me.id]?.sos; $('#btnSOS').textContent = on ? '✕' : 'SOS'; $('#twSOS').textContent = on ? '✕ Atcelt SOS' : 'SOS (turi 2 s)'; }

/* ================= Čats ================= */
function sendChat(text, kind = 'normal', loc) {
  text = String(text).trim(); if (!text) return;
  const p = { id: uid(), from: S.me.id, name: S.me.name, color: S.me.color, text, kind, t: Date.now() };
  if (loc) Object.assign(p, { lat: loc.lat, lng: loc.lng });
  Sync.send('chat', p);
}
function renderChat() {
  const box = $('#chatList');
  if (!S.chat.length) { box.innerHTML = `<div class="empty">${S.hunt ? 'Vēl nav ziņu. Izmanto ātrās pogas zemāk.' : 'Pievienojies medībām (cilnē “Komanda”), lai sarakstītos ar komandu.'}</div>`; return; }
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = S.chat.map(c => {
    const me = c.from === S.me.id;
    const loc = c.lat != null ? `<div><a href="#" class="loc" data-lat="${c.lat}" data-lng="${c.lng}">📍 rādīt kartē</a></div>` : '';
    const pending = S.outbox.some(o => o.payload && o.payload.id === c.id) ? ' ⏳' : '';
    return `<div class="msg ${me ? 'me' : ''} ${c.kind === 'alert' ? 'alert' : ''}"><div class="who" style="color:${esc(c.color || '')}">${me ? 'Es' : esc(c.name)} · ${fmtTime(c.t)}${pending}</div>${esc(c.text)}${loc}</div>`;
  }).join('');
  if (atBottom || current === 'chat') box.scrollTop = box.scrollHeight;
}
$('#chatList').addEventListener('click', e => { const a = e.target.closest('.loc'); if (!a) return; e.preventDefault(); showView('map'); map.setView([+a.dataset.lat, +a.dataset.lng], 16); L.popup().setLatLng([+a.dataset.lat, +a.dataset.lng]).setContent('Ziņas vieta').openOn(map); });
$('#chatForm').onsubmit = e => { e.preventDefault(); if (!S.hunt) return toast('Vispirms pievienojies medībām'); sendChat($('#chatInput').value); $('#chatInput').value = ''; };
function renderQuick() {
  $('#quickMsgs').innerHTML = '<button data-loc="1">📍 Mana vieta</button>' + QUICK.map(q => `<button>${esc(q)}</button>`).join('');
  $('#quickMsgs').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (!S.hunt) return toast('Vispirms pievienojies medībām');
    if (b.dataset.loc) { if (!myPos) return toast('Nav GPS'); return sendChat('📍 Esmu šeit', 'normal', myPos); }
    sendChat(b.textContent, /⚠|💥|🎯|🐕|palīdzība/.test(b.textContent) ? 'alert' : 'normal', myPos);
  };
}
function updateBadge() { const b = $('#chatBadge'); b.textContent = S.unread; b.classList.toggle('hidden', !S.unread); }

/* ================= Komanda / medības ================= */
function renderHeader() {
  $('#huntTitle').textContent = S.hunt ? S.hunt.name : 'Nav medību';
  $('#statusText').textContent = S.hunt ? ({ plan: 'Plānotas', active: '🟢 Notiek', ended: '🏁 Beigušās' }[S.hunt.status] || '—') : 'pievienojies cilnē Komanda';
  setConn(Sync.connected ? 'on' : (S.hunt && Sync.server ? 'wait' : 'off'));
}
function renderTeam() {
  const card = $('#huntCard');
  if (!S.hunt) {
    card.innerHTML = `<h3>Medības</h3><p class="muted">Izveido jaunas medības un nosūti kodu komandai, vai ievadi saņemto kodu.</p>
      <label>Medību nosaukums<input id="hName" placeholder="piem., Dzinējmedības Rūjienā"></label>
      <label>Parole (nav obligāta)<input id="hPass" type="text" autocomplete="off" placeholder="bez paroles var pievienoties ikviens ar kodu"></label>
      <button class="btn primary" id="hCreate" style="width:100%">Izveidot medības</button>
      <label style="margin-top:16px">Pievienoties ar kodu<input id="hCode" placeholder="piem., K7Q2M" style="text-transform:uppercase" maxlength="12"></label>
      <button class="btn" id="hJoin" style="width:100%">Pievienoties</button>
      ${Sync.server ? '' : '<p class="muted" style="font-size:12px">⚠ Serveris nav pieejams — medības darbosies tikai šajā ierīcē.</p>'}`;
    $('#hCreate').onclick = () => {
      const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      joinHunt(code, $('#hName').value.trim() || 'Medības ' + new Date().toLocaleDateString('lv-LV'), true, $('#hPass').value.trim());
    };
    $('#hJoin').onclick = () => { const c = $('#hCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length < 3) return toast('Ievadi kodu'); joinHunt(c); };
  } else {
    const link = location.origin + location.pathname + '#' + S.hunt.code;
    card.innerHTML = `<h3>${esc(S.hunt.name)}</h3>
      <div class="kv"><b>Kods</b><span style="font-size:22px;font-weight:800;letter-spacing:3px;color:var(--accent2)">${esc(S.hunt.code)}</span><b>Saite</b><span style="word-break:break-all;font-size:12px">${esc(link)}</span></div>
      <div class="row gap">
        <button class="btn" id="hShare">📤 Dalīties</button>
        <button class="btn" id="hQR">▦ QR</button>
        <button class="btn ${S.hunt.status === 'active' ? '' : 'primary'}" id="hStatus">${S.hunt.status === 'active' ? '🏁 Beigt medības' : '▶ Sākt medības'}</button>
        <button class="btn" id="hPlan">📅 Plāns</button>
        ${isOwner() ? `<button class="btn" id="hPass">${S.hunt.hasPass ? '🔒 Parole' : '🔓 Parole'}</button>` : ''}
        <button class="btn" id="hRename">✏</button>
        <button class="btn danger" id="hLeave">Iziet</button>
      </div>
      ${planLine() ? `<div class="kv" style="margin-top:10px">${planLine()}</div>` : ''}
      ${isOwner() ? '<p class="muted" style="font-size:12px;margin:8px 0 0">★ Tu esi medību vadītājs (vari mainīt paroli un izslēgt dalībniekus).</p>' : ''}`;
    $('#hPlan').onclick = planSheet;
    const hp = $('#hPass'); if (hp) hp.onclick = passSheet;
    $('#hShare').onclick = async () => {
      const text = `Pievienojies medībām "${S.hunt.name}": kods ${S.hunt.code}\n${link}`;
      try { if (navigator.share) await navigator.share({ title: 'Medības', text, url: link }); else { await navigator.clipboard.writeText(text); toast('Nokopēts'); } } catch (_) {}
    };
    $('#hQR').onclick = () => showQR('Pievienoties: ' + S.hunt.name, link, 'Kods ' + S.hunt.code + ' · ' + link);
    $('#hStatus').onclick = () => {
      const st = S.hunt.status === 'active' ? 'ended' : 'active';
      Sync.send('hunt', { status: st });
      sendChat(st === 'active' ? '▶ Medības sākušās! Ievērojiet šaušanas sektorus.' : '🏁 Medības beigušās. Ieroči izlādēti!', 'alert');
    };
    $('#hRename').onclick = () => openSheet(`<h2>Pārdēvēt medības</h2><label>Nosaukums<input id="rn" value="${esc(S.hunt.name)}"></label><button class="btn primary" id="rnOk" style="width:100%">Saglabāt</button>`, r => {
      r.querySelector('#rnOk').onclick = () => { const v = r.querySelector('#rn').value.trim(); if (v) Sync.send('hunt', { name: v }); closeSheet(); };
    });
    $('#hLeave').onclick = () => {
      const b = $('#hLeave'); if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Tiešām iziet?'; return; }
      Sync.send('leave', { id: S.me.id }); Sync.flush().finally(() => leaveHunt());
    };
  }
  // dalībnieki
  const mems = Object.values(S.members).filter(m => m.name);
  if (S.hunt && !S.members[S.me.id]) mems.unshift(Object.assign({}, S.me, myPos || {}, { t: Date.now() }));
  $('#memberCount').textContent = mems.length ? '(' + mems.length + ')' : '';
  $('#memberList').innerHTML = mems.length ? mems.sort((a, b) => (b.sos - a.sos) || (a.id === S.me.id ? -1 : b.id === S.me.id ? 1 : a.name.localeCompare(b.name))).map(m => {
    const me = m.id === S.me.id;
    const d = !me && myPos && m.lat != null ? `${fmtDist(dist(myPos, m))} ${compass(bearing(myPos, m))}` : '';
    const stand = Object.values(S.markers).find(x => x.type === 'stand' && x.assigned === m.id);
    return `<div class="item ${m.sos ? 'sos' : ''}" data-id="${esc(m.id)}"><div class="av" style="background:${esc(m.color)}">${m.role === 'dog' ? '🐕' : esc(initials(m.name))}</div>
      <div class="meta"><div>${esc(m.name)}${me ? ' (es)' : ''} ${m.sos ? '🆘' : ''}</div><div>${ROLES[m.role] || ''}${stand ? ' · 🪜 ' + esc(stand.name || 'tornis') : ''} · ${me ? 'tagad' : ago(m.t)}${(me ? batLevel() : m.bat) != null ? ` · <span style="color:${(me ? batLevel() : m.bat) < 20 ? 'var(--bad)' : 'inherit'}">🔋 ${me ? batLevel() : m.bat}%</span>` : ''}</div></div>
      <div class="muted" style="text-align:right;font-size:13px">${d}</div></div>`;
  }).join('') : '<div class="empty">Neviena dalībnieka</div>';
  // GPS trackeri
  $('#trackerList').innerHTML = !S.hunt ? '<div class="empty">Pievienojies medībām</div>' :
    Object.values(S.trackers || {}).map(t => { const m = S.members['trk-' + t.dev]; return `<div class="item" data-dev="${esc(t.dev)}"><div class="av" style="background:${esc(t.color)}">${t.role === 'dog' ? '🐕' : '📡'}</div><div class="meta"><div>${esc(t.name)}</div><div>ID ${esc(t.dev)} · ${m && m.t ? ago(m.t) + (m.bat != null ? ' · 🔋 ' + m.bat + '%' : '') : 'nav signāla'}</div></div><button class="btn sm danger" data-del="${esc(t.dev)}">✕</button></div>`; }).join('') +
    '<button class="btn" id="trkAdd" style="width:100%">＋ Pievienot GPS trackeri</button>';
  const ta = $('#trkAdd'); if (ta) ta.onclick = trackerSheet;
  // torņi
  const stands = Object.values(S.markers).filter(m => m.type === 'stand').sort((a, b) => String(a.name).localeCompare(String(b.name), 'lv', { numeric: true }));
  $('#standList').innerHTML = stands.length ? stands.map(s => {
    const who = s.assigned && (S.members[s.assigned]?.name || (s.assigned === S.me.id ? S.me.name : ''));
    return `<div class="item" data-mk="${esc(s.id)}"><div class="av" style="background:${who ? (S.members[s.assigned]?.color || S.me.color) : '#555'}">🪜</div>
      <div class="meta"><div>${esc(s.name || 'Tornis')}</div><div>${who ? esc(who) : 'brīvs'}${s.dir != null ? ' · sektors ' + compass(s.dir) : ''}</div></div>
      <div class="muted" style="font-size:13px">${myPos ? fmtDist(dist(myPos, s)) : ''}</div></div>`;
  }).join('') : '<div class="empty">Nav torņu. Pievieno tos kartē ar ＋ → 🪜</div>';
}
$('#memberList').onclick = e => { const it = e.target.closest('.item'); if (!it) return; const id = it.dataset.id; if (id === S.me.id) { showView('map'); myPos && map.setView([myPos.lat, myPos.lng], 16); } else memberSheet(id); };
$('#trackerList').onclick = e => {
  const del = e.target.closest('[data-del]');
  if (del) { if (!del.dataset.ok) { del.dataset.ok = 1; del.textContent = 'Dzēst?'; return; } return Sync.send('tracker_del', { dev: del.dataset.del }); }
  const it = e.target.closest('.item'); if (!it) return; const m = S.members['trk-' + it.dataset.dev];
  if (m && m.lat != null) { showView('map'); map.setView([m.lat, m.lng], 16); } else toast('No šī trackera vēl nav saņemts signāls');
};
$('#standList').onclick = e => { const it = e.target.closest('.item'); if (!it) return; const m = S.markers[it.dataset.mk]; showView('map'); map.setView([m.lat, m.lng], 16); markerSheet(m.id); };

let listT;
function throttleLists() { towerSoon(); clearTimeout(listT); listT = setTimeout(() => { if (current === 'team') renderTeam(); if (current === 'log') renderLog(); }, 400); }

async function joinHunt(code, name, created, pass) {
  if (!S.me.name) { showView('more'); toast('Vispirms ievadi savu vārdu profilā'); $('#pfName').focus(); return; }
  if (!created && pass == null && Sync.server) {
    try {
      const info = await (await fetch('api/hunt/' + encodeURIComponent(code) + '/info', { cache: 'no-store' })).json();
      if (info.hasPass) return askPassword(code, 'Medības „' + (info.name || code) + '” ir aizsargātas ar paroli.');
      if (!info.exists) toast('Medības ar kodu ' + code + ' vēl nav izveidotas — tiek izveidotas jaunas', 4000);
      name = name || info.name;
    } catch (_) {}
  }
  if (S.hunt && S.hunt.code !== code) leaveHunt(true);
  S.hunt = { code, name: name || 'Medības ' + code, status: 'plan', pass: pass || '' };
  S.trackers = {};
  S.members = {}; S.markers = {}; S.chat = []; S.zone = []; S.outbox = []; S.unread = 0;
  clearMapLayers();
  save(); renderAll();
  Sync.connect();
  if (created) Sync.send('hunt', Object.assign({ name: S.hunt.name, status: 'plan' }, pass ? { pass } : {}));
  if (created) S.hunt.owner = S.me.id;
  pushMember(true);
  sendChat(`${S.me.name} pievienojās (${ROLES[S.me.role]})`, 'normal');
  history.replaceState(null, '', location.pathname + '#' + code);
  toast(created ? 'Medības izveidotas — dalies ar kodu ' + code : 'Pievienojies medībām ' + code);
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(() => Push.register()).catch(() => {});
}
const isOwner = () => !!(S.hunt && S.hunt.owner && S.hunt.owner === S.me.id);
function askPassword(code, msg) {
  showView('team');
  openSheet(`<h2>🔒 Parole</h2><p class="muted">${esc(msg)}</p><label>Parole<input id="pwIn" type="text" autocomplete="off"></label>
    <div class="row gap"><button class="btn primary grow" id="pwOk">Pievienoties</button><button class="btn" id="pwNo">Atcelt</button></div>`, r => {
    r.querySelector('#pwIn').focus();
    r.querySelector('#pwOk').onclick = async () => {
      const pw = r.querySelector('#pwIn').value.trim(); if (!pw) return;
      try {
        const res = await fetch('api/hunt/' + encodeURIComponent(code) + '?id=' + S.me.id + '&k=' + encodeURIComponent(pw), { cache: 'no-store' });
        if (res.status === 403) { const e = (await res.json()).error; return toast(e === 'banned' ? 'Tu esi izslēgts no šīm medībām' : 'Nepareiza parole'); }
      } catch (_) {}
      closeSheet();
      if (S.hunt && S.hunt.code === code) { S.hunt.pass = pw; save(); Sync.connect(); } else joinHunt(code, null, false, pw);
    };
    r.querySelector('#pwNo').onclick = () => { closeSheet(); if (S.hunt && S.hunt.code === code && !Sync.connected) leaveHunt(true); };
  });
}
function passSheet() {
  openSheet(`<h2>Medību parole</h2><p class="muted">${S.hunt.hasPass ? 'Parole ir iestatīta. Nomainot to, jaunajiem dalībniekiem būs jāievada jaunā parole, bet pašreizējiem — arī (pēc atkārtota savienojuma).' : 'Bez paroles pievienoties var ikviens, kurš zina kodu.'}</p>
    <label>Jaunā parole<input id="npw" type="text" autocomplete="off" value=""></label>
    <div class="row gap"><button class="btn primary grow" id="npwOk">Saglabāt</button>${S.hunt.hasPass ? '<button class="btn danger" id="npwDel">Noņemt paroli</button>' : ''}</div>`, r => {
    r.querySelector('#npwOk').onclick = () => { const v = r.querySelector('#npw').value.trim(); if (!v) return toast('Ievadi paroli'); Sync.send('hunt', { pass: v }); S.hunt.hasPass = true; closeSheet(); toast('Parole iestatīta — paziņo to komandai'); renderTeam(); };
    const d = r.querySelector('#npwDel'); if (d) d.onclick = () => { Sync.send('hunt', { pass: '' }); S.hunt.hasPass = false; closeSheet(); renderTeam(); };
  });
}
/* Medību plāns: sākuma laiks un pulcēšanās vieta */
function planLine() {
  if (!S.hunt) return '';
  let out = '';
  if (S.hunt.start) {
    const t = new Date(S.hunt.start), diff = t - Date.now();
    out += `<b>Sākums</b><span>${pad2(t.getDate())}.${pad2(t.getMonth() + 1)} ${hhmm(t)}${diff > 0 ? ' · pēc ' + untilStr(diff) : ''}</span>`;
  }
  if (S.hunt.meet) out += `<b>Pulcēšanās</b><span>${esc(S.hunt.meet)}</span>`;
  const mine = Object.values(S.markers).find(x => x.type === 'stand' && x.assigned === S.me.id);
  if (mine) out += `<b>Mans tornis</b><span>🪜 ${esc(mine.name || 'tornis')}${myPos ? ' · ' + fmtDist(dist(myPos, mine)) + ' ' + compass(bearing(myPos, mine)) : ''}</span>`;
  return out;
}
function planSheet() {
  const st = S.hunt.start ? S.hunt.start.slice(0, 16) : '';
  const stands = Object.values(S.markers).filter(x => x.type === 'stand');
  const people = Object.values(S.members).filter(m => m.name && !m.tracker);
  if (!people.some(m => m.id === S.me.id)) people.unshift(S.me);
  openSheet(`<h2>📅 Medību plāns</h2>
    <label>Sākuma laiks<input id="plStart" type="datetime-local" value="${esc(st)}"></label>
    <label>Pulcēšanās vieta / piezīmes<input id="plMeet" value="${esc(S.hunt.meet || '')}" placeholder="piem., pie mednieku mājas 7:30"></label>
    <h3>Torņu sadale</h3>
    ${stands.length ? stands.map(x => `<label>${esc(x.name || 'Tornis')}<select data-st="${esc(x.id)}"><option value="">— brīvs —</option>${people.map(m => `<option value="${esc(m.id)}" ${x.assigned === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>`).join('') : '<p class="muted">Vēl nav torņu — pievieno tos kartē ar ＋ → 🪜. Dalībnieki, kuriem piešķirsi torni, saņems paziņojumu.</p>'}
    <button class="btn primary" id="plOk" style="width:100%">Saglabāt plānu</button>`, r => {
    r.querySelector('#plOk').onclick = () => {
      const start = r.querySelector('#plStart').value, meet = r.querySelector('#plMeet').value.trim();
      if (start !== st || meet !== (S.hunt.meet || '')) Sync.send('hunt', { start: start ? new Date(start).toISOString() : '', meet });
      r.querySelectorAll('select[data-st]').forEach(sel => {
        const m = S.markers[sel.dataset.st];
        if (m && (m.assigned || '') !== sel.value) Sync.send('marker', Object.assign({}, m, { assigned: sel.value, updated: Date.now(), updatedBy: S.me.id }));
      });
      if (start && start !== st) sendChat(`📅 Medības sāksies ${new Date(start).toLocaleString('lv-LV', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${meet ? ' · ' + meet : ''}`, 'normal');
      closeSheet(); toast('Plāns saglabāts'); renderTeam();
    };
  });
}
/* GPS trackeri (OsmAnd / Traccar protokols) */
function trackerSheet() {
  const url = location.origin + '/api/tracker';
  openSheet(`<h2>📡 GPS trackeris</h2>
    <p class="muted" style="font-size:13px">Derīgs jebkurš trackeris vai lietotne, kas atbalsta <b>OsmAnd</b> protokolu (piem., <b>Traccar Client</b> uz veca telefona suņa vestē, daudzi GPS trackeri). Tajā iestati:<br>
    Servera adrese: <b style="word-break:break-all">${esc(url)}</b><br>Ierīces ID: tas pats, ko ievadi zemāk.</p>
    <label>Ierīces ID<input id="tkDev" placeholder="piem., 123456 vai IMEI" autocomplete="off"></label>
    <label>Nosaukums<input id="tkName" placeholder="piem., Reksis"></label>
    <label>Veids<select id="tkRole"><option value="dog">Suns</option><option value="driver">Dzinējs</option><option value="hunter">Mednieks</option><option value="observer">Cits</option></select></label>
    <label>Krāsa<input id="tkColor" type="color" value="#9b6b3c"></label>
    <button class="btn primary" id="tkOk" style="width:100%">Pievienot</button>`, r => {
    r.querySelector('#tkOk').onclick = () => {
      const dev = r.querySelector('#tkDev').value.trim(); if (!dev) return toast('Ievadi ierīces ID');
      if (!Sync.server) return toast('Trackeriem vajag serveri');
      Sync.send('tracker', { dev, name: r.querySelector('#tkName').value.trim() || 'Trackeris', role: r.querySelector('#tkRole').value, color: r.querySelector('#tkColor').value });
      closeSheet(); toast('Trackeris pievienots — tas parādīsies kartē, tiklīdz sūtīs atrašanās vietu');
    };
  });
}
function leaveHunt(silent) {
  Sync.disconnect();
  S.hunt = null; S.members = {}; S.markers = {}; S.chat = []; S.zone = []; S.outbox = []; S.unread = 0; S.trackers = {};
  clearMapLayers(); save(); renderAll(); updateBadge(); stopReplay();
  history.replaceState(null, '', location.pathname);
  if (!silent) toast('Izgāji no medībām');
}
function clearMapLayers() {
  Object.values(memLayers).forEach(l => map.removeLayer(l)); Object.keys(memLayers).forEach(k => delete memLayers[k]);
  Object.values(mkLayers).forEach(l => map.removeLayer(l)); Object.keys(mkLayers).forEach(k => delete mkLayers[k]);
  Object.values(sectorLayers).forEach(l => map.removeLayer(l)); Object.keys(sectorLayers).forEach(k => delete sectorLayers[k]);
}

/* ================= Žurnāls un eksports ================= */
let logFilter = 'harvest';
function journalItems() {
  const all = Object.assign({}, S.journal);
  Object.values(S.markers).forEach(m => { if (['harvest', 'obs'].includes(m.type)) all[m.id] = Object.assign({}, all[m.id] || {}, m); });
  return Object.values(all).filter(m => logFilter === 'all' || m.type === logFilter).sort((a, b) => b.t - a.t);
}
function renderLog() {
  const items = journalItems();
  const stats = {}; items.forEach(m => { const k = m.species || 'Nenoteikta'; stats[k] = (stats[k] || 0) + (m.type === 'obs' ? (m.count || 1) : 1); });
  $('#logStats').innerHTML = Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span>${esc(k)}: <b>${v}</b></span>`).join('') || '';
  $('#logList').innerHTML = items.length ? items.map(m => {
    const t = TYPES[m.type];
    const sub = [fmtTime(m.t), m.hunt, m.hunter || m.byName, m.sex, m.age, m.weight && m.weight + ' kg'].filter(Boolean).map(esc).join(' · ');
    return `<div class="item" data-id="${esc(m.id)}"><div class="av" style="background:${t.c}">${t.i}</div><div class="meta"><div>${esc(m.species || t.n)}${m.count > 1 ? ' ×' + m.count : ''}</div><div>${sub}</div>${m.note ? `<div>${esc(m.note)}</div>` : ''}</div></div>`;
  }).join('') : '<div class="empty">Ierakstu vēl nav. Atzīmē kartē ＋ → 🎯 Nomedīts vai 👁 Novērojums.</div>';
}
$('#logSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; logFilter = b.dataset.f; $$('#logSeg button').forEach(x => x.classList.toggle('on', x === b)); renderLog(); };
$('#logList').onclick = e => { const it = e.target.closest('.item'); if (!it) return; const m = S.markers[it.dataset.id] || S.journal[it.dataset.id]; if (!m) return; showView('map'); map.setView([m.lat, m.lng], 16); if (S.markers[m.id]) markerSheet(m.id); };

function download(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: name }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
$('#btnExportCSV').onclick = () => {
  const f = logFilter; logFilter = 'all'; const items = journalItems(); logFilter = f;
  const cols = ['Laiks', 'Tips', 'Suga', 'Skaits', 'Dzimums', 'Vecums', 'Svars_kg', 'Mednieks', 'Medības', 'Platums', 'Garums', 'Piezīme'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = items.map(m => [new Date(m.t).toISOString(), TYPES[m.type].n, m.species, m.count || 1, m.sex, m.age, m.weight, m.hunter || m.byName, m.hunt, m.lat.toFixed(6), m.lng.toFixed(6), m.note].map(q).join(';'));
  download('medibu-zurnals.csv', 'text/csv', '﻿' + cols.join(';') + '\n' + rows.join('\n'));
};
$('#btnExportGPX').onclick = () => {
  const x = s => esc(s);
  const wpts = Object.values(S.markers).map(m => `<wpt lat="${m.lat}" lon="${m.lng}"><time>${new Date(m.t).toISOString()}</time><name>${x((TYPES[m.type] || {}).n + (m.name ? ' ' + m.name : '') + (m.species ? ' ' + m.species : ''))}</name><desc>${x(m.note || '')}</desc></wpt>`).join('\n');
  const trks = [...S.tracks, S.track.length ? { name: 'Pašreizējais', pts: S.track } : null].filter(Boolean).map(t => `<trk><name>${x(t.name)}</name><trkseg>${t.pts.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join('')}</trkseg></trk>`).join('\n');
  download('medibas.gpx', 'application/gpx+xml', `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Medibas" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n${trks}\n</gpx>`);
};

/* ================= Karte bezsaistei ================= */
const TILE_CACHE = 'medibas-tiles-v1', DL_MAX = 6000;
function dlBounds() {
  if (S.zone.length >= 3) return L.latLngBounds(S.zone.map(p => [p[0], p[1]])).pad(0.1);
  return map.getBounds();
}
function tileRange(b, z) {
  const nw = map.project(b.getNorthWest(), z).divideBy(256).floor(), se = map.project(b.getSouthEast(), z).divideBy(256).floor();
  return { x0: nw.x, x1: se.x, y0: nw.y, y1: se.y, n: (se.x - nw.x + 1) * (se.y - nw.y + 1) };
}
function tileCount(maxZ) {
  const b = dlBounds(); const z0 = Math.max(8, Math.min(map.getZoom() - 2, 12));
  let n = 0; for (let z = z0; z <= maxZ; z++) n += tileRange(b, z).n;
  return n * (1 + Object.keys(activeOverlays).length);
}
async function downloadArea(maxZ, stat, btn) {
  if (!('caches' in window)) return toast('Šis pārlūks neatbalsta kartes saglabāšanu');
  const total = tileCount(maxZ);
  if (total > DL_MAX) { stat.textContent = `Par daudz flīžu (${total}). Izvēlies mazāku detalizāciju vai iezīmē mazāku medību zonu.`; return; }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}
  btn.disabled = true;
  const b = dlBounds(), z0 = Math.max(8, Math.min(map.getZoom() - 2, 12));
  const layersToGet = [baseLayer, ...Object.values(activeOverlays)];
  const urls = [];
  for (const lyr of layersToGet) for (let z = z0; z <= maxZ; z++) {
    const r = tileRange(b, z), maxN = lyr.options.maxNativeZoom || lyr.options.maxZoom || 19;
    if (z > maxN || (lyr.options.minZoom && z < lyr.options.minZoom)) continue;
    const saved = lyr._tileZoom; lyr._tileZoom = z;           // Leaflet ņem z no _tileZoom
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) { try { urls.push(lyr.getTileUrl(Object.assign(L.point(x, y), { z }))); } catch (_) {} }
    lyr._tileZoom = saved;
  }
  const cache = await caches.open(TILE_CACHE);
  let done = 0, ok = 0, skip = 0, i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        if (await cache.match(u)) skip++;
        else { const res = await fetch(u, { mode: 'no-cors' }); if (res.ok || res.type === 'opaque') { await cache.put(u, res); ok++; } }
      } catch (_) {}
      done++; if (done % 10 === 0 || done === urls.length) stat.textContent = `Lejupielādē… ${done}/${urls.length}`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  btn.disabled = false;
  stat.textContent = `✅ Gatavs: ${ok} jaunas, ${skip} jau bija saglabātas${urls.length - ok - skip ? ', ' + (urls.length - ok - skip) + ' neizdevās' : ''}.`;
  toast('Karte saglabāta lietošanai bez interneta');
}

/* ================= Medību atkārtošana ================= */
let replay = null;
async function startReplay() {
  if (!S.hunt || !Sync.server) return toast('Atkārtošanai vajag medības ar serveri');
  let data;
  try {
    const r = await fetch('api/hunt/' + encodeURIComponent(S.hunt.code) + '/tracks?id=' + S.me.id + '&k=' + encodeURIComponent(S.hunt.pass || ''), { cache: 'no-store' });
    data = await r.json();
  } catch (_) { return toast('Neizdevās ielādēt kustības datus'); }
  const ids = Object.keys(data.tracks || {}).filter(id => data.tracks[id].length > 1);
  if (!ids.length) return toast('Vēl nav kustības datu — tie krājas medību laikā');
  let t0 = Infinity, t1 = 0;
  ids.forEach(id => { const tr = data.tracks[id]; t0 = Math.min(t0, tr[0][2]); t1 = Math.max(t1, tr[tr.length - 1][2]); });
  showView('map');
  replay = { data, ids, t0, t1, t: t0, playing: false, layer: L.layerGroup().addTo(map), iv: null, speed: 60 };
  const all = []; ids.forEach(id => data.tracks[id].forEach(p => all.push([p[0], p[1]])));
  map.fitBounds(L.latLngBounds(all).pad(0.15));
  setMode('replay', '', [
    ['▶', () => toggleReplay(), 'primary'],
    ['×60', e => { replay.speed = replay.speed === 60 ? 300 : replay.speed === 300 ? 15 : 60; e.target.textContent = '×' + replay.speed; }],
    ['Aizvērt', () => stopReplay()],
  ]);
  $('#modeText').innerHTML = `<div id="rpTime"></div><input id="rpSlider" type="range" min="${t0}" max="${t1}" value="${t0}" step="1000" style="width:100%">`;
  $('#rpSlider').oninput = e => { replay.t = +e.target.value; drawReplay(); };
  drawReplay();
}
function toggleReplay() {
  if (!replay) return;
  replay.playing = !replay.playing;
  $('#modeBtns button').textContent = replay.playing ? '⏸' : '▶';
  clearInterval(replay.iv);
  if (replay.playing) replay.iv = setInterval(() => {
    replay.t = Math.min(replay.t1, replay.t + 250 * replay.speed);
    if (replay.t >= replay.t1) toggleReplay();
    $('#rpSlider').value = replay.t; drawReplay();
  }, 250);
}
function drawReplay() {
  const R = replay; if (!R) return;
  R.layer.clearLayers();
  for (const id of R.ids) {
    const tr = R.data.tracks[id], who = R.data.who[id] || {};
    let lo = 0, hi = tr.length - 1;
    if (tr[0][2] > R.t) continue;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tr[mid][2] <= R.t) lo = mid; else hi = mid - 1; }
    const pts = tr.slice(0, lo + 1).map(p => [p[0], p[1]]);
    L.polyline(pts, { color: who.color || '#fff', weight: 3, opacity: .75 }).addTo(R.layer);
    L.circleMarker(pts[pts.length - 1], { radius: 8, color: '#fff', weight: 2, fillColor: who.color || '#ccc', fillOpacity: 1 }).bindTooltip(esc(who.name || '?'), { permanent: true, direction: 'top', offset: [0, -8] }).addTo(R.layer);
  }
  const d = new Date(R.t);
  $('#rpTime').innerHTML = `⏪ <b>${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${hhmm(d)}:${pad2(d.getSeconds())}</b> <span class="muted">· ${R.ids.length} dalībnieki</span>`;
}
function stopReplay() {
  if (!replay) return;
  clearInterval(replay.iv); map.removeLayer(replay.layer); replay = null;
  if (mode === 'replay') setMode(null);
}

/* ================= Push paziņojumi (strādā arī, kad aplikācija aizvērta) ================= */
const Push = {
  supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
  async register(force) {
    if (!this.supported() || !S.hunt || !Sync.server) return renderPushState();
    if (Notification.permission !== 'granted') {
      if (!force) return renderPushState();
      if (await Notification.requestPermission() !== 'granted') { toast('Paziņojumi nav atļauti — tos var atļaut pārlūka iestatījumos'); return renderPushState(); }
    }
    try {
      const { key } = await (await fetch('api/push/key', { cache: 'no-store' })).json();
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && S.pushKey && S.pushKey !== key) { await sub.unsubscribe(); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
      S.pushKey = key;
      const r = await fetch('api/hunt/' + encodeURIComponent(S.hunt.code) + '/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.me.id, k: S.hunt.pass || '', sub: sub.toJSON() }) });
      S.pushOn = r.ok; save();
      if (force && r.ok) toast('Paziņojumi ieslēgti 🔔');
    } catch (e) { console.warn('push', e); S.pushOn = false; if (force) toast('Neizdevās ieslēgt paziņojumus' + (/iPhone|iPad/.test(navigator.userAgent) ? ' — iPhone tie strādā tikai, ja aplikācija pievienota sākuma ekrānam' : '')); }
    renderPushState();
  },
};
function b64ToU8(b64) { const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); }
function renderPushState() {
  const el = $('#pushState'); if (!el) return;
  el.textContent = !Push.supported() ? 'Šajā pārlūkā nav atbalstīts' + (/iPhone|iPad/.test(navigator.userAgent) ? ' (iPhone: pievieno aplikāciju sākuma ekrānam)' : '') :
    !S.hunt ? 'Ieslēdzas, kad pievienojies medībām' : S.pushOn ? '🔔 Ieslēgti' : Notification.permission === 'denied' ? 'Aizliegti pārlūka iestatījumos' : 'Izslēgti';
  $('#btnPush').classList.toggle('hidden', !Push.supported() || S.pushOn || !S.hunt);
}

/* ================= QR kods ================= */
function showQR(title, text, sub) {
  openSheet(`<h2>${esc(title)}</h2><div id="qrBox" style="background:#fff;padding:14px;border-radius:12px;width:max-content;margin:8px auto"></div>
    <p style="text-align:center;word-break:break-all;font-size:13px" class="muted">${esc(sub || text)}</p>
    <button class="btn" id="qrCopy" style="width:100%">Kopēt saiti</button>`, r => {
    const box = r.querySelector('#qrBox');
    if (typeof QRCode === 'function') new QRCode(box, { text, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    else box.outerHTML = '<p class="muted" style="text-align:center">QR kodu neizdevās ielādēt (vajag internetu). Izmanto saiti.</p>';
    r.querySelector('#qrCopy').onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Nokopēts'); } catch (_) { toast(text, 6000); } };
  });
}
$('#btnAppQR').onclick = () => showQR('Atvērt aplikāciju', location.origin + location.pathname);

/* ================= Saule, mēness, laikapstākļi ================= */
function sunTimes(date, lat, lng) {
  const dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
  const toJ = d => d.valueOf() / dayMs - 0.5 + J1970, fromJ = j => new Date((j + 0.5 - J1970) * dayMs);
  const lw = rad * -lng, phi = rad * lat, d = toJ(date) - J2000;
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const Lm = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(Lm));
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * Lm);
  const set = h => { const w = Math.acos((Math.sin(h * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))); return J2000 + 0.0009 + (w + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * Lm); };
  const out = { noon: fromJ(Jnoon) };
  for (const [k, h] of [['sun', -0.833], ['civil', -6]]) { const js = set(h); out[k + 'Set'] = fromJ(js); out[k + 'Rise'] = fromJ(Jnoon - (js - Jnoon)); }
  return out;
}
function moonPhase(date) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((date - ref) / 864e5) % syn + syn) % syn;
  const names = ['🌑 Jauns mēness', '🌒 Augošs sirpis', '🌓 Pirmais ceturksnis', '🌔 Augošs', '🌕 Pilnmēness', '🌖 Dilstošs', '🌗 Pēdējais ceturksnis', '🌘 Dilstošs sirpis'];
  const illum = Math.round((1 - Math.cos(2 * Math.PI * age / syn)) / 2 * 100);
  return { name: names[Math.floor((age / syn) * 8 + 0.5) % 8], illum, age: age.toFixed(1) };
}
function renderSun() {
  const c = myPos || map.getCenter();
  const s = sunTimes(new Date(), c.lat, c.lng), mo = moonPhase(new Date());
  $('#sunPill').textContent = `☀ ${hhmm(s.sunRise)}–${hhmm(s.sunSet)}`;
  const now = new Date();
  const light = now < s.civilRise ? 'tumšs (līdz ' + hhmm(s.civilRise) + ')' : now > s.civilSet ? 'tumšs' : now > s.sunSet ? 'krēsla līdz ' + hhmm(s.civilSet) : 'gaišs';
  $('#sunDetail').innerHTML = `<b>Rīta krēsla</b><span>${hhmm(s.civilRise)}</span><b>Saullēkts</b><span>${hhmm(s.sunRise)}</span><b>Saule zenītā</b><span>${hhmm(s.noon)}</span>
    <b>Saulriets</b><span>${hhmm(s.sunSet)}</span><b>Vakara krēsla</b><span>${hhmm(s.civilSet)}</span><b>Tagad</b><span>${light}</span>
    <b>Mēness</b><span>${mo.name}, ${mo.illum}% apgaismots</span>`;
}
async function loadWeather() {
  const c = myPos || (map && map.getCenter()); if (!c) return;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(3)}&longitude=${c.lng.toFixed(3)}&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,pressure_msl&hourly=wind_direction_10m,wind_speed_10m&forecast_hours=6&wind_speed_unit=ms&timezone=auto`);
    const j = await r.json(); const cu = j.current;
    S.weather = { dir: cu.wind_direction_10m, speed: cu.wind_speed_10m, gust: cu.wind_gusts_10m, temp: cu.temperature_2m, feels: cu.apparent_temperature, prec: cu.precipitation, cloud: cu.cloud_cover, press: cu.pressure_msl, hourly: j.hourly, t: Date.now() };
    renderWeather(); renderScent();
  } catch (_) { $('#windPill').textContent = '🌬 nav datu'; }
}
function renderWeather() {
  const w = S.weather; if (!w) return;
  const arrow = `<span style="display:inline-block;transform:rotate(${(w.dir + 180) % 360}deg)">↑</span>`;
  $('#windPill').innerHTML = `${arrow} ${w.speed.toFixed(0)} m/s ${compass(w.dir)} · ${Math.round(w.temp)}°`;
  const hours = w.hourly ? w.hourly.time.slice(0, 6).map((t, i) => `${t.slice(11, 16)} ${compass(w.hourly.wind_direction_10m[i])} ${w.hourly.wind_speed_10m[i].toFixed(0)}`).join(' · ') : '';
  $('#weatherDetail').innerHTML = `<b>Vējš</b><span>${arrow} no ${compass(w.dir)} (${Math.round(w.dir)}°), ${w.speed.toFixed(1)} m/s, brāzmas ${w.gust.toFixed(0)} m/s</span>
    <b>Temperatūra</b><span>${w.temp.toFixed(1)}° (sajūtu ${w.feels.toFixed(0)}°)</span><b>Nokrišņi</b><span>${w.prec} mm · mākoņi ${w.cloud}%</span>
    <b>Spiediens</b><span>${Math.round(w.press)} hPa</span><b>Vējš 6 h</b><span style="font-size:12px">${hours}</span><b>Atjaunots</b><span>${hhmm(new Date(w.t))}</span>`;
}
setInterval(() => { loadWeather(); renderSun(); }, 15 * 60000);

/* ================= Treks ================= */
$('#btnTrack').onclick = () => {
  if (!S.recording) {
    S.recording = true; S.track = []; trackLine.setLatLngs([]); Geo.wake();
    if (myPos) S.track.push([myPos.lat, myPos.lng, Date.now()]);
    toast('Maršruta ieraksts sākts');
  } else {
    S.recording = false;
    if (S.track.length > 1) { S.tracks.push({ name: 'Maršruts ' + fmtTime(S.track[0][2]), pts: S.track }); if (S.tracks.length > 20) S.tracks.shift(); toast('Saglabāts: ' + fmtDist(trackLen(S.track))); }
    S.track = []; trackLine.setLatLngs([]);
  }
  $('#btnTrack').classList.toggle('rec', S.recording); $('#btnTrack').textContent = S.recording ? '⏹' : '⏺';
  save(); updateInfoChip(); updateTrackChip();
};

/* ================= Torņa režīms (tumšs, minimāls ekrāns) =================
 * Karte tiek paslēpta (netiek zīmēta un ielādētas flīzes), kompass izslēgts,
 * ekrāns melns ar blāvi sarkanu tekstu — maz tērē OLED ekrānos un nebojā redzi tumsā. */
let towerOn = false, towerT = null;
const mapVisible = () => current === 'map' && !towerOn && document.visibilityState === 'visible';
let mapDirty = false;
function towerSoon() { if (!towerOn || towerT) return; towerT = setTimeout(() => { towerT = null; renderTower(); }, 700); }
function enterTower() {
  towerOn = true; document.body.classList.add('tower');
  $('#tower').classList.remove('hidden'); compassSync(); renderTower();
  enterTower._wl = !S.settings.wake; S.settings.wake = true; wake();
  enterTower._iv = setInterval(renderTower, 15000);
}
function exitTower() {
  towerOn = false; document.body.classList.remove('tower');
  $('#tower').classList.add('hidden'); clearInterval(enterTower._iv);
  if (enterTower._wl) { S.settings.wake = false; wake(); }
  showView('map');
}
function untilStr(ms) { const m = Math.round(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
function renderTower() {
  if (!towerOn) return;
  const now = new Date(), c = myPos || (map && map.getCenter()) || { lat: 56.9, lng: 24.6 };
  const st = sunTimes(now, c.lat, c.lng);
  let sun;
  if (now < st.sunRise) sun = `Saullēkts ${hhmm(st.sunRise)} (pēc ${untilStr(st.sunRise - now)})`;
  else if (now < st.sunSet) sun = `Saulriets ${hhmm(st.sunSet)} (pēc ${untilStr(st.sunSet - now)})`;
  else if (now < st.civilSet) sun = `Krēsla līdz ${hhmm(st.civilSet)} (${untilStr(st.civilSet - now)})`;
  else sun = 'Tumšs · saullēkts ' + hhmm(sunTimes(new Date(now.getTime() + 864e5), c.lat, c.lng).sunRise);
  const w = S.weather;
  const wind = w ? `Vējš no ${compass(w.dir)} ${w.speed.toFixed(0)} m/s → smarža uz ${compass((w.dir + 180) % 360)}` : '';
  const stand = Object.values(S.markers).find(x => x.type === 'stand' && x.assigned === S.me.id);
  const bat = batLevel();
  const gps = !myPos ? 'GPS: gaida signālu' : `GPS ±${Math.round(myPos.acc)} m · ${Geo.mode === 'still' ? 'taupīšana' : 'aktīvs'}`;
  const mems = Object.values(S.members).filter(m => m.id !== S.me.id && m.name);
  mems.forEach(m => m._d = myPos && m.lat != null ? dist(myPos, m) : Infinity);
  mems.sort((a, b) => (b.sos - a.sos) || a._d - b._d);
  const rows = mems.slice(0, 10).map(m => `<div class="tw-row ${m.sos ? 'sos' : ''}"><span>${m.sos ? '🆘 ' : ''}${esc(m.name)}${m.role === 'dog' ? ' 🐕' : ''}</span><span>${isFinite(m._d) ? fmtDist(m._d) + ' ' + compass(bearing(myPos, m)) : '—'}</span><span class="tw-dim">${ago(m.t)}${m.bat != null ? ' · ' + m.bat + '%' : ''}</span></div>`).join('') || '<div class="tw-dim">Nav citu dalībnieku</div>';
  const msgs = S.chat.slice(-4).reverse().map(m => `<div class="tw-msg ${m.kind === 'alert' ? 'alert' : ''}"><span class="tw-dim">${hhmm(new Date(m.t))} ${esc(m.from === S.me.id ? 'Es' : m.name)}:</span> ${esc(m.text)}</div>`).join('') || '<div class="tw-dim">Nav ziņu</div>';
  $('#twBody').innerHTML = `
    <div class="tw-clock">${hhmm(now)}</div>
    <div>${sun}</div>
    ${wind ? `<div>${wind}</div>` : ''}
    <div class="tw-dim">${S.hunt ? esc(S.hunt.name) + ' · ' + ({ plan: 'plānotas', active: 'NOTIEK', ended: 'beigušās' }[S.hunt.status] || '') : 'Nav medību'}${stand ? ' · 🪜 ' + esc(stand.name || 'tornis') + (stand.dir != null ? ' (sektors ' + compass(stand.dir) + ')' : '') : ''}</div>
    <div class="tw-dim">${gps}${bat != null ? ' · 🔋 ' + bat + '%' : ''}</div>
    <div id="twSector" class="tw-sector hidden"></div>
    ${S.hunt && S.hunt.start && new Date(S.hunt.start) > now ? `<div>Sākums ${hhmm(new Date(S.hunt.start))} (pēc ${untilStr(new Date(S.hunt.start) - now)})</div>` : ''}
    <h4>Komanda</h4>${rows}
    <h4>Ziņas</h4>${msgs}`;
  const tw = $('#twSector'); tw.innerHTML = lastSector.map(f => esc(f.text)).join('<br>'); tw.classList.toggle('hidden', !lastSector.length);
}
$('#btnTower').onclick = enterTower;
$('#twExit').onclick = exitTower;
$('#twQuick').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (!S.hunt) return toast('Vispirms pievienojies medībām');
  sendChat(b.dataset.t, b.dataset.a ? 'alert' : 'normal', myPos); vibrate(60); renderTower();
};

/* ================= Skati un pogas ================= */
let current = 'map';
function showView(v) {
  current = v;
  $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'map') setTimeout(() => { map.invalidateSize(); if (mapDirty) renderAllMap(); if (follow && myPos) map.panTo([myPos.lat, myPos.lng]); }, 50);
  compassSync();
  if (v === 'team') renderTeam();
  if (v === 'log') renderLog();
  if (v === 'chat') { S.unread = 0; updateBadge(); renderChat(); const b = $('#chatList'); b.scrollTop = b.scrollHeight; }
  if (v === 'more') { renderSun(); renderWeather(); }
}
$('#tabbar').onclick = e => { const b = e.target.closest('button'); if (b) showView(b.dataset.v); };

$('#btnAdd').onclick = () => startPlace();
$('#btnFollow').onclick = () => { follow = !follow; $('#btnFollow').classList.toggle('on', follow); if (follow && myPos) map.setView([myPos.lat, myPos.lng], Math.max(map.getZoom(), 15)); if (!myPos) toast('Gaidu GPS signālu…'); };
$('#btnMeasure').onclick = () => {
  if (mode === 'measure') return setMode(null);
  setMode('measure', '📏 Pieskaries kartei — attālums no tevis vai starp punktiem', [['Atsaukt', () => { measurePts.pop(); drawMeasure(); }], ['Gatavs', () => setMode(null), 'primary']]);
};
$('#btnLayers').onclick = () => {
  const groups = {};
  Object.entries(LAYERS).forEach(([k, l]) => (groups[l.g || 'Pasaules kartes'] = groups[l.g || 'Pasaules kartes'] || []).push([k, l]));
  openSheet(`<h2>Kartes fons</h2>${Object.entries(groups).map(([g, list]) => `<div class="muted" style="font-size:12px;margin:10px 2px 6px">${esc(g)}</div><div class="list">${list.map(([k, l]) => `<button class="btn ${S.settings.layer === k ? 'primary' : ''}" data-k="${k}" style="text-align:left">${esc(l.n)}</button>`).join('')}</div>`).join('')}
    <h2 style="margin-top:18px">Pārklājumi <span class="muted" style="font-size:12px;font-weight:400">LVM GEO</span></h2>
    ${Object.entries(OVERLAYS).map(([k, o]) => `<label class="sw"><input type="checkbox" data-o="${k}" ${activeOverlays[k] ? 'checked' : ''}> ${esc(o.n)}${o.o.minZoom > 10 ? ` <span class="muted" style="font-size:11px">(redzams tuvinot)</span>` : ''}</label>`).join('')}
    <h2 style="margin-top:18px">Karte bez interneta</h2>
    <p class="muted" style="font-size:13px">Lejupielādē ${S.zone.length >= 3 ? '<b>medību zonu</b>' : '<b>redzamo apgabalu</b>'} ar izvēlēto fonu${Object.keys(activeOverlays).length ? ' un ieslēgtajiem pārklājumiem' : ''}, lai karte strādātu mežā bez zonas.</p>
    <label>Detalizācija<select id="dlZoom">${[14, 15, 16, 17, 18].map(z => `<option value="${z}" ${z === 16 ? 'selected' : ''}>līdz ${z}. tuvinājumam — ${tileCount(z)} flīzes</option>`).join('')}</select></label>
    <button class="btn" id="dlGo" style="width:100%">⬇ Lejupielādēt</button>
    <div id="dlStat" class="muted" style="font-size:13px;margin-top:6px"></div>
    <p class="muted" style="font-size:12px">LVM GEO dati: AS “Latvijas valsts meži”.</p>`, r => {
    r.querySelector('#dlZoom').onclick = e => e.stopPropagation();
    r.querySelector('#dlGo').onclick = e => { e.stopPropagation(); downloadArea(+r.querySelector('#dlZoom').value, r.querySelector('#dlStat'), r.querySelector('#dlGo')); };
    r.onclick = e => { const b = e.target.closest('button[data-k]'); if (!b) return; setLayer(b.dataset.k); closeSheet(); };
    r.querySelectorAll('input[data-o]').forEach(i => i.onchange = () => setOverlay(i.dataset.o, i.checked));
  });
};
$('#btnZone').onclick = () => {
  showView('map');
  const before = S.zone.slice();
  setMode('zone', '✏ Pieskaries kartei, lai pievienotu robežas punktus', [
    ['Atsaukt', () => { S.zone.pop(); renderZone(); }],
    ['Gatavs', () => { const pts = S.zone.slice(); setMode(null); Sync.send('zone', { points: pts }); toast('Zona saglabāta'); }, 'primary'],
    ['Atcelt', () => { S.zone = before; setMode(null); }],
  ]);
  renderZone();
};
$('#btnZoneClear').onclick = () => { Sync.send('zone', { points: [] }); toast('Zona notīrīta'); };

/* Profils un iestatījumi */
function renderSettings() {
  $('#pfName').value = S.me.name; $('#pfRole').value = S.me.role; $('#pfColor').value = S.me.color;
  $('#setWake').checked = S.settings.wake; $('#setScent').checked = S.settings.scent; $('#setSectors').checked = S.settings.sectors;
  $('#setVibrate').checked = S.settings.vibrate; $('#setPower').checked = S.settings.power; $('#setCompass').checked = S.settings.compass; $('#setInterval').value = S.settings.interval; $('#setShare').checked = S.settings.share;
}
$('#pfSave').onclick = () => {
  const n = $('#pfName').value.trim(); if (!n) return toast('Ievadi vārdu');
  S.me.name = n; S.me.role = $('#pfRole').value; S.me.color = $('#pfColor').value; save();
  pushMember(true); renderMe(); toast('Profils saglabāts');
  if (pendingJoin) { const c = pendingJoin; pendingJoin = null; joinHunt(c); showView('team'); }
};
$('#setWake').onchange = e => { S.settings.wake = e.target.checked; save(); wake(); };
$('#setScent').onchange = e => { S.settings.scent = e.target.checked; save(); if (!S.weather) loadWeather(); renderScent(); };
$('#setSectors').onchange = e => { S.settings.sectors = e.target.checked; save(); Object.keys(S.markers).forEach(renderMarker); };
$('#setVibrate').onchange = e => { S.settings.vibrate = e.target.checked; save(); };
$('#setCompass').onchange = e => { S.settings.compass = e.target.checked; save(); if (e.target.checked) initCompass(); else compassSync(); renderMe(); };
$('#setPower').onchange = e => { S.settings.power = e.target.checked; save(); if (!e.target.checked) Geo.active(); else Geo.wake(); };
$('#setInterval').onchange = e => { S.settings.interval = +e.target.value; save(); };
$('#setShare').onchange = e => { S.settings.share = e.target.checked; save(); if (!e.target.checked && S.hunt) Sync.send('member', { id: S.me.id, name: S.me.name, role: S.me.role, color: S.me.color, lat: null, lng: null, t: Date.now() }); };
$('#btnWeather').onclick = loadWeather;
$('#btnPush').onclick = () => Push.register(true);
$('#btnReplay').onclick = startReplay;
$('#btnReset').onclick = () => { const b = $('#btnReset'); if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Spied vēlreiz, lai dzēstu'; return; } localStorage.removeItem(KEY); location.reload(); };

let wakeLock = null;
async function wake() {
  try {
    if (S.settings.wake && 'wakeLock' in navigator) { if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } }
    else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (_) {}
}
document.addEventListener('visibilitychange', () => { compassSync(); if (document.visibilityState === 'visible') { if (mapDirty) renderAllMap(); renderTower(); wake(); Sync.flush(); if (S.hunt && Sync.server && !Sync.connected) Sync.connect(); } });

function renderAll() { renderHeader(); renderAllMap(); renderChat(); renderSOS(); renderTeam(); renderLog(); updateBadge(); }

/* ================= Starts ================= */
let pendingJoin = null;
(async function init() {
  load();
  if (typeof L === 'undefined') {
    document.getElementById('map').innerHTML = '<div style="padding:40px 20px;text-align:center;color:#9fae94">Kartes bibliotēku neizdevās ielādēt.<br>Pirmajai palaišanai vajadzīgs internets — pēc tam aplikācija strādā arī bezsaistē.<br><br><button class="btn primary" onclick="location.reload()">Mēģināt vēlreiz</button></div>';
    return;
  }
  initMap(); renderSettings(); renderQuick(); initSOS($('#btnSOS')); initSOS($('#twSOS'));
  if (S.settings.compass) { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') compassAllowed = false; else { compassAllowed = true; } compassSync(); }
  $('#btnTrack').classList.toggle('rec', S.recording); $('#btnTrack').textContent = S.recording ? '⏹' : '⏺';
  $('#btnFollow').classList.add('on');
  renderAll(); renderSun(); renderWeather(); renderPushState();
  startGeo(); wake();
  await Sync.probe();
  const hashCode = location.hash.slice(1).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (hashCode && (!S.hunt || S.hunt.code !== hashCode)) {
    if (S.me.name) joinHunt(hashCode); else { pendingJoin = hashCode; showView('more'); toast('Ievadi savu vārdu, lai pievienotos medībām ' + hashCode, 4000); }
  } else if (S.hunt) Sync.connect();
  else if (!S.me.name) { showView('more'); toast('Sveiks! Sāc ar savu vārdu un lomu.', 3500); }
  renderHeader();
  window.addEventListener('hashchange', () => {
    const c = location.hash.slice(1).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c && (!S.hunt || S.hunt.code !== c)) { if (S.me.name) { joinHunt(c); showView('team'); } else { pendingJoin = c; showView('more'); } }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
