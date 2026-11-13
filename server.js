// Medību komandas serveris — bez ārējām atkarībām (Node 18+).
//   node server.js            (PORT=8080 pēc noklusējuma)
// Iespējas: reāllaika sinhronizācija (SSE), medību parole un dalībnieku izmešana, kustības treki
// atkārtošanai, GPS trackeri (OsmAnd/Traccar protokols), Web Push paziņojumi,
// datu glabāšana failā vai Supabase (ja iestatīti SUPABASE_URL un SUPABASE_KEY).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_KEY || '';
const PUSH_SUB = process.env.PUSH_CONTACT || 'mailto:medibas@example.com';
const MAX_CHAT = 300, MAX_TRACK = 4000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const b64u = buf => Buffer.from(buf).toString('base64url');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');

/* ================= Glabāšana ================= */
let rooms = {};            // code -> room
let photos = {};           // 'CODE/markerId' -> dataURL (glabājas atsevišķi, lai medību dati paliktu mazi)
let meta = {};             // { vapid: {pub, priv} }
const dirty = new Set();   // istabas, kas jāsaglabā

const Store = {
  async load() {
    if (SB_URL && SB_KEY) {
      try {
        const r = await fetch(SB_URL + '/rest/v1/medibas_rooms?select=code,data', { headers: sbHeaders() });
        if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + await r.text());
        for (const row of await r.json()) {
          if (row.code === '__meta') meta = row.data || {};
          else if (row.code.startsWith('ph:')) photos[row.code.slice(3)] = row.data && row.data.img;
          else rooms[row.code] = row.data;
        }
        console.log('Supabase: ielādētas', Object.keys(rooms).length, 'medības');
        return;
      } catch (e) { console.error('Supabase ielāde neizdevās, izmantoju failu:', e.message); }
    }
    try { const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); rooms = d.rooms || (d.__meta ? {} : d); meta = d.__meta || meta; photos = d.photos || {}; } catch (_) {}
  },
  async flush() {
    if (!dirty.size) return;
    const codes = [...dirty]; dirty.clear();
    if (SB_URL && SB_KEY) {
      const rows = codes.map(c => c === '__meta' ? { code: c, data: meta } : c.startsWith('ph:') ? (photos[c.slice(3)] ? { code: c, data: { img: photos[c.slice(3)] } } : null) : rooms[c] ? { code: c, data: rooms[c] } : null).filter(Boolean);
      const del = codes.filter(c => c !== '__meta' && (c.startsWith('ph:') ? !photos[c.slice(3)] : !rooms[c]));
      try {
        if (rows.length) {
          const r = await fetch(SB_URL + '/rest/v1/medibas_rooms', { method: 'POST', headers: Object.assign(sbHeaders(), { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }), body: JSON.stringify(rows.map(x => Object.assign(x, { updated_at: new Date().toISOString() }))) });
          if (!r.ok) throw new Error(r.status + ' ' + await r.text());
        }
        for (const c of del) await fetch(SB_URL + '/rest/v1/medibas_rooms?code=eq.' + encodeURIComponent(c), { method: 'DELETE', headers: sbHeaders() });
      } catch (e) { console.error('Supabase saglabāšana neizdevās:', e.message); codes.forEach(c => dirty.add(c)); }
    }
    fs.writeFile(DATA_FILE, JSON.stringify({ rooms, __meta: meta, photos }), () => {});
  },
};
function sbHeaders() { return { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }; }
let saveTimer = null;
function saveSoon(code) { if (code) dirty.add(code); clearTimeout(saveTimer); saveTimer = setTimeout(() => Store.flush(), 2000); }

/* ================= Medības ================= */
const clients = {}; // code -> Set(res)
function cleanCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
function room(code, create = true) {
  code = cleanCode(code);
  if (!code) return null;
  if (!rooms[code] && create) {
    rooms[code] = { code, name: 'Medības ' + code, status: 'plan', start: '', meet: '', owner: '', admins: [], passHash: '', banned: [], tokens: {}, members: {}, markers: {}, chat: [], zone: [], trackers: {}, push: {}, tracks: {}, created: Date.now() };
  }
  const r = rooms[code];
  if (r) for (const [k, v] of Object.entries({ banned: [], admins: [], tokens: {}, trackers: {}, push: {}, tracks: {}, owner: '', passHash: '', start: '', meet: '' })) if (r[k] == null) r[k] = Array.isArray(v) ? [] : (typeof v === 'object' ? {} : v);
  return r;
}
// Tas, ko redz klienti (bez paroles, push abonementiem un trekiem)
function publicRoom(r) {
  const { passHash, push, tracks, banned, tokens, ...rest } = r;
  const trackers = {};
  for (const [k, t] of Object.entries(r.trackers || {})) { const { keyHash, ...pub } = t; trackers[k] = Object.assign(pub, { secured: !!keyHash }); }
  return Object.assign(rest, { hasPass: !!passHash, trackers });
}
/* Piekļuves pārbaude.
 * Parole: ja medībām ir parole, tā jāzina.
 * Dalībnieka atslēga: pirmajā pieprasījumā dalībnieka ID tiek piesaistīts slepenai atslēgai (glabā tikai jaucējvērtību),
 * pēc tam ar šo ID var darboties tikai tas, kurš zina atslēgu — citi nevar uzdoties par vadītāju vai citu dalībnieku. */
function authorized(r, id, key, token, register = true) {
  if (id && r.banned.includes(id)) return 'banned';
  if (r.passHash && sha(key || '') !== r.passHash) return 'password';
  if (id) {
    if (!token || String(token).length < 16) return 'token';
    const h = sha(token);
    if (r.tokens[id] && r.tokens[id] !== h) return 'token';
    if (!r.tokens[id] && register) { r.tokens[id] = h; saveSoon(r.code); }
  }
  return '';
}
const isAdmin = (r, id) => !r.owner || id === r.owner || r.admins.includes(id);
const PLAN_TYPES = ['stand', 'drive'];
function same(a, b, ignore) { const k = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); for (const x of k) if (!ignore.includes(x) && JSON.stringify(a[x]) !== JSON.stringify(b[x])) return false; return true; }

function broadcast(code, ev) {
  const set = clients[code]; if (!set) return;
  const line = 'data: ' + JSON.stringify(ev) + '\n\n';
  for (const c of set) { try { c.res.write(line); } catch (_) {} }
}
function kickStream(code, id) {
  const set = clients[code]; if (!set) return;
  for (const c of set) if (c.id === id) { try { c.res.write('data: ' + JSON.stringify({ type: 'kicked' }) + '\n\n'); c.res.end(); } catch (_) {} set.delete(c); }
}

function addTrack(r, id, p) {
  if (p.lat == null || p.lng == null) return;
  const tr = r.tracks[id] = r.tracks[id] || [];
  const last = tr[tr.length - 1];
  if (last && Math.abs(last[0] - p.lat) < 0.00009 && Math.abs(last[1] - p.lng) < 0.00015 && (p.t || Date.now()) - last[2] < 120000) return; // < ~10 m un < 2 min
  tr.push([+(+p.lat).toFixed(6), +(+p.lng).toFixed(6), p.t || Date.now()]);
  if (tr.length > MAX_TRACK) tr.splice(0, tr.length - MAX_TRACK);
}

// Notikuma pielietošana. Atgriež true, ja jāpārraida visiem.
function apply(r, ev, sender) {
  const p = ev.payload || {};
  switch (ev.type) {
    case 'pos': case 'member':
      if (!p.id || (sender && p.id !== sender)) return false;
      r.members[p.id] = Object.assign(r.members[p.id] || {}, p);
      if (ev.type === 'pos') addTrack(r, p.id, p);
      return true;
    case 'leave':
      if (sender && p.id !== sender && !isAdmin(r, sender)) return false;
      delete r.members[p.id]; return true;
    case 'marker': {
      if (!p.id || !p.type) return false;
      const old = r.markers[p.id];
      if (sender && !isAdmin(r, sender)) {
        if (PLAN_TYPES.includes(p.type) || (old && PLAN_TYPES.includes(old.type))) {
          // ne-vadītājs drīkst tikai ieņemt brīvu torni sev vai atbrīvot savu
          if (!old || old.type !== 'stand' || p.type !== 'stand') return false;
          if (!same(old, p, ['assigned', 'updated', 'updatedBy', 'photo'])) return false;
          if (!((p.assigned === sender && (!old.assigned || old.assigned === sender)) || (!p.assigned && old.assigned === sender))) return false;
        } else if (old && old.by && old.by !== sender) return false;            // svešu atzīmi mainīt nedrīkst
        if (!old && p.by && p.by !== sender) return false;
      }
      // foto glabā atsevišķi; atzīmē paliek tikai karodziņš
      if (typeof p.photo === 'string' && p.photo.startsWith('data:image/')) {
        if (p.photo.length > 900000) return false;
        photos[r.code + '/' + p.id] = p.photo; saveSoon('ph:' + r.code + '/' + p.id); p.photo = String(Date.now());
      } else if (p.photo && old && old.photo) p.photo = old.photo;
      else if (!p.photo && old && old.photo && !p.photoRemoved) p.photo = old.photo;
      if (!p.photo) { delete p.photo; if (photos[r.code + '/' + p.id]) { delete photos[r.code + '/' + p.id]; saveSoon('ph:' + r.code + '/' + p.id); } }
      delete p.photoRemoved;
      r.markers[p.id] = p; return true;
    }
    case 'marker_del': {
      const old = r.markers[p.id]; if (!old) return false;
      if (sender && !isAdmin(r, sender) && (PLAN_TYPES.includes(old.type) || (old.by && old.by !== sender))) return false;
      delete r.markers[p.id];
      if (photos[r.code + '/' + p.id]) { delete photos[r.code + '/' + p.id]; saveSoon('ph:' + r.code + '/' + p.id); }
      return true;
    }
    case 'chat':
      if (!p.id || r.chat.some(c => c.id === p.id)) return false;
      if (sender && p.from !== sender) return false;                            // ziņu var sūtīt tikai savā vārdā
      r.chat.push(p); if (r.chat.length > MAX_CHAT) r.chat.splice(0, r.chat.length - MAX_CHAT);
      return true;
    case 'zone':
      if (sender && !isAdmin(r, sender)) return false;
      r.zone = Array.isArray(p.points) ? p.points.slice(0, 500) : []; return true;
    case 'sos':
      if (!p.id || (sender && p.id !== sender)) return false;
      r.members[p.id] = Object.assign(r.members[p.id] || {}, { id: p.id, name: p.name || (r.members[p.id] || {}).name, sos: !!p.active, lat: p.lat, lng: p.lng, t: p.t });
      return true;
    case 'hunt': {
      if (!r.owner && sender && p.claimOwner) r.owner = sender;   // izveidotājs (vai īpašnieks pēc servera restarta)
      const isOwner = !sender || sender === r.owner;
      if (sender && !isAdmin(r, sender)) return false;           // medību iestatījumus maina tikai vadītājs
      if (Array.isArray(p.admins) && isOwner) r.admins = p.admins.filter(x => typeof x === 'string').slice(0, 20);
      if (p.name) r.name = String(p.name).slice(0, 80);
      if (p.status) r.status = p.status;
      if (p.start != null) r.start = String(p.start).slice(0, 40);
      if (p.meet != null) r.meet = String(p.meet).slice(0, 120);
      if ('pass' in p && isOwner) r.passHash = p.pass ? sha(p.pass) : '';
      ev.payload = { name: r.name, status: r.status, start: r.start, meet: r.meet, owner: r.owner, admins: r.admins, hasPass: !!r.passHash };
      return true;
    }
    case 'kick':
      if (sender && !isAdmin(r, sender)) return false;
      if (!p.id || p.id === r.owner) return false;
      if (!r.banned.includes(p.id)) r.banned.push(p.id);
      delete r.members[p.id]; delete r.push[p.id]; delete r.tokens[p.id];
      r.admins = r.admins.filter(x => x !== p.id);
      setTimeout(() => kickStream(r.code, p.id), 50);
      return true;
    case 'tracker': {
      if (!p.dev || (sender && !isAdmin(r, sender))) return false;
      p.dev = String(p.dev).slice(0, 64);
      const prev = r.trackers[p.dev] || {};
      r.trackers[p.dev] = { dev: p.dev, name: String(p.name || 'Trackeris').slice(0, 40), role: p.role || 'dog', color: p.color || '#9b6b3c', keyHash: p.key ? sha(p.key) : prev.keyHash || '' };
      const { keyHash, ...pub } = r.trackers[p.dev];
      ev.payload = Object.assign(pub, { secured: !!keyHash });              // atslēga netiek izsūtīta citiem
      return true;
    }
    case 'tracker_del':
      if (sender && !isAdmin(r, sender)) return false;
      delete r.trackers[p.dev]; delete r.members['trk-' + p.dev]; return true;
  }
  return false;
}

/* ================= Web Push (RFC 8291 / 8292, bez bibliotēkām) ================= */
function vapid() {
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) return { pub: process.env.VAPID_PUBLIC, priv: process.env.VAPID_PRIVATE };
  if (!meta.vapid) {
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    meta.vapid = { pub: b64u(ecdh.getPublicKey()), priv: b64u(ecdh.getPrivateKey()) };
    saveSoon('__meta');
  }
  return meta.vapid;
}
function vapidAuth(endpoint) {
  const { pub, priv } = vapid();
  const pubBuf = Buffer.from(pub, 'base64url');
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: priv, x: b64u(pubBuf.subarray(1, 33)), y: b64u(pubBuf.subarray(33, 65)) }, format: 'jwk' });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH_SUB }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${pub}`;
}
function encryptPush(sub, payload) {
  const uaPub = Buffer.from(sub.keys.p256dh, 'base64url'), auth = Buffer.from(sub.keys.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), shared = ecdh.computeSecret(uaPub);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}
async function sendPush(r, memberId, msg) {
  const sub = r.push[memberId]; if (!sub || !sub.endpoint) return;
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST', body: encryptPush(sub, JSON.stringify(msg)),
      headers: { Authorization: vapidAuth(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: msg.urgent ? 'high' : 'normal' },
    });
    if (res.status === 404 || res.status === 410) { delete r.push[memberId]; saveSoon(r.code); }
  } catch (e) { console.warn('push:', e.message); }
}
function pushAll(r, sender, msg, only) {
  for (const id of Object.keys(r.push)) if (id !== sender && (!only || only === id)) sendPush(r, id, Object.assign({ hunt: r.code, tag: r.code + '-' + (msg.kind || 'msg') }, msg));
}
// Kuri notikumi rada paziņojumu telefonā
function notifyFor(r, ev, sender, before) {
  const p = ev.payload || {};
  if (ev.type === 'sos' && p.active) pushAll(r, sender, { title: '🆘 SOS: ' + (p.name || ''), body: 'Vajadzīga palīdzība! Pieskaries, lai redzētu kartē.', urgent: true, kind: 'sos' });
  else if (ev.type === 'chat' && p.kind === 'alert') pushAll(r, sender, { title: r.name, body: (p.name || '') + ': ' + p.text, urgent: true, kind: 'alert' });
  else if (ev.type === 'hunt' && before && before.status !== r.status && r.status !== 'plan') pushAll(r, sender, { title: r.name, body: r.status === 'active' ? '▶ Medības sākušās' : '🏁 Medības beigušās — ieroči izlādēti!', urgent: true, kind: 'status' });
  else if (ev.type === 'marker' && p.type === 'stand' && p.assigned && (!before || before.assigned !== p.assigned) && p.assigned !== sender)
    pushAll(r, sender, { title: r.name, body: `🪜 Tev piešķirts tornis ${p.name || ''}`, kind: 'stand' }, p.assigned);
}

/* ================= HTTP ================= */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 4e6) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => resolve(b)); req.on('error', reject);
  });
}
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

// GPS trackeri: OsmAnd protokols (?id=&lat=&lon=...) vai Traccar Client JSON
function trackerPing(q, body, key) {
  let d = { dev: q.get('id') || q.get('deviceid'), lat: +q.get('lat'), lng: +q.get('lon'), acc: +q.get('accuracy') || null, heading: q.get('bearing') != null ? +q.get('bearing') : null, bat: q.get('batt') != null ? Math.round(+q.get('batt')) : null, t: q.get('timestamp') ? (+q.get('timestamp') < 1e12 ? +q.get('timestamp') * 1000 : +q.get('timestamp')) : Date.now() };
  if ((!d.dev || isNaN(d.lat)) && body) {
    try {
      const j = JSON.parse(body), loc = j.location || {}, c = loc.coords || {};
      d = { dev: j.device_id || j.id, lat: c.latitude, lng: c.longitude, acc: c.accuracy, heading: c.heading >= 0 ? c.heading : null, bat: loc.battery && loc.battery.level != null ? Math.round(loc.battery.level * 100) : null, t: loc.timestamp ? Date.parse(loc.timestamp) : Date.now() };
    } catch (_) {}
  }
  if (!d.dev || d.lat == null || isNaN(d.lat) || isNaN(d.lng)) return 0;
  d.dev = String(d.dev); let n = 0;
  for (const r of Object.values(rooms)) {
    const tr = r.trackers && r.trackers[d.dev]; if (!tr) continue;
    if (tr.keyHash && sha(key || '') !== tr.keyHash) continue;              // aizsargātam trackerim vajag atslēgu adresē
    const ev = { type: 'pos', payload: { id: 'trk-' + d.dev, name: tr.name, role: tr.role, color: tr.color, tracker: true, lat: d.lat, lng: d.lng, acc: d.acc ? Math.round(d.acc) : null, heading: d.heading, bat: d.bat, t: d.t || Date.now() } };
    if (apply(r, ev)) { broadcast(r.code, ev); saveSoon(r.code); n++; }
  }
  return n;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);
  const q = url.searchParams;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Hunt-Key, X-Member-Id', 'Access-Control-Allow-Methods': 'GET,POST' });
    return res.end();
  }

  // OsmAnd trackeri sūta uz saknes adresi ar ?id=&lat=&lon=
  if ((parts[0] === 'api' && parts[1] === 'tracker') || (url.pathname === '/' && q.get('id') && q.get('lat'))) {
    const body = req.method === 'POST' ? await readBody(req).catch(() => '') : '';
    const n = trackerPing(q, body, parts[0] === 'api' ? parts[2] || q.get('key') : q.get('key'));
    res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(n ? 'OK' : 'UNKNOWN DEVICE');
  }

  if (parts[0] === 'api') {
    if (parts[1] === 'ping') return send(res, 200, { ok: true, t: Date.now(), storage: SB_URL && SB_KEY ? 'supabase' : 'file' });
    if (parts[1] === 'push' && parts[2] === 'key') return send(res, 200, { key: vapid().pub });

    if (parts[1] === 'hunt' && parts[2]) {
      const code = cleanCode(parts[2]);
      const key = q.get('k') || req.headers['x-hunt-key'] || '';
      const id = q.get('id') || req.headers['x-member-id'] || '';
      const tok = q.get('t') || req.headers['x-member-token'] || '';

      // Vai medības eksistē / vai vajag paroli (pirms pievienošanās)
      if (parts[3] === 'info') {
        const r = room(code, false);
        return send(res, 200, r ? { exists: true, name: r.name, hasPass: !!r.passHash } : { exists: false });
      }

      const r = room(code);
      if (!r) return send(res, 400, { error: 'bad code' });
      const deny = authorized(r, id, key, tok);

      if (parts[3] === 'stream' && req.method === 'GET') {
        if (deny) return send(res, 403, { error: deny });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*' });
        res.write('retry: 3000\n\n');
        res.write('data: ' + JSON.stringify({ type: 'snapshot', payload: publicRoom(r) }) + '\n\n');
        const c = { res, id };
        (clients[r.code] = clients[r.code] || new Set()).add(c);
        const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (_) {} }, 20000);
        req.on('close', () => { clearInterval(ka); clients[r.code] && clients[r.code].delete(c); });
        return;
      }

      if (parts[3] === 'event' && req.method === 'POST') {
        let body;
        try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'bad json' }); }
        const list = Array.isArray(body) ? body : (body.events || [body]);
        const sender = (!Array.isArray(body) && body.id) || id;
        if (!sender) return send(res, 403, { error: 'token' });
        const d = authorized(r, sender, (!Array.isArray(body) && body.k) || key, (!Array.isArray(body) && body.t) || tok);
        if (d) return send(res, 403, { error: d });
        let n = 0; const rejected = [];
        list.forEach((ev, i) => {
          if (!ev || typeof ev.type !== 'string') return;
          const before = ev.type === 'hunt' ? { status: r.status } : ev.type === 'marker' && ev.payload ? r.markers[ev.payload.id] && Object.assign({}, r.markers[ev.payload.id]) : null;
          if (apply(r, ev, sender)) { broadcast(r.code, ev); notifyFor(r, ev, sender, before); n++; }
          else if (['marker', 'marker_del', 'zone', 'hunt', 'kick', 'tracker', 'tracker_del'].includes(ev.type)) rejected.push(ev.type);
        });
        if (n) saveSoon(r.code);
        return send(res, 200, { ok: true, applied: n, rejected });
      }

      if (parts[3] === 'push' && req.method === 'POST') {
        try {
          const b = JSON.parse(await readBody(req));
          if (!b.id || authorized(r, b.id, b.k, b.t)) return send(res, 403, { error: 'denied' });
          if (b.sub && b.sub.endpoint && b.sub.keys) r.push[b.id] = { endpoint: b.sub.endpoint, keys: b.sub.keys }; else delete r.push[b.id];
          saveSoon(r.code); return send(res, 200, { ok: true });
        } catch (_) { return send(res, 400, { error: 'bad json' }); }
      }

      if (parts[3] === 'photo' && parts[4] && req.method === 'GET') {
        if (deny) return send(res, 403, { error: deny });
        const img = photos[r.code + '/' + parts[4]];
        if (!img) return send(res, 404, { error: 'no photo' });
        const m = img.match(/^data:(image\/[a-z]+);base64,(.*)$/);
        if (!m) return send(res, 404, { error: 'bad photo' });
        res.writeHead(200, { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable' });
        return res.end(Buffer.from(m[2], 'base64'));
      }

      if (parts[3] === 'tracks' && req.method === 'GET') {
        if (deny) return send(res, 403, { error: deny });
        const who = {};
        for (const tid of Object.keys(r.tracks)) { const m = r.members[tid] || {}; who[tid] = { name: m.name || '?', color: m.color || '#ccc', role: m.role }; }
        return send(res, 200, { tracks: r.tracks, who });
      }

      if (req.method === 'GET' && !parts[3]) return deny ? send(res, 403, { error: deny }) : send(res, 200, publicRoom(r));
    }
    return send(res, 404, { error: 'not found' });
  }

  // Statiskie faili
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (p === '/' || p === '\\') p = '/index.html';
  const file = path.join(PUBLIC, p);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) {
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }); res.end(d2);
      });
    }
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (['.js', '.html', '.webmanifest', '.css'].includes(ext)) headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers); res.end(data);
  });
});

// Tīrīšana: dalībnieki bez ziņām > 24 h, treki > 7 dienas, medības bez aktivitātes > 30 dienas
setInterval(() => {
  const now = Date.now();
  for (const code of Object.keys(rooms)) {
    const r = room(code);
    let ch = false;
    for (const id of Object.keys(r.members)) if (now - (r.members[id].t || 0) > 864e5) { delete r.members[id]; ch = true; }
    for (const id of Object.keys(r.tracks)) { const t = r.tracks[id]; if (t.length && now - t[t.length - 1][2] > 7 * 864e5) { delete r.tracks[id]; ch = true; } }
    const last = Math.max(r.created || 0, ...r.chat.map(c => c.t || 0), ...Object.values(r.markers).map(m => m.t || 0));
    if (now - last > 30 * 864e5 && !(clients[code] && clients[code].size)) {
      delete rooms[code]; dirty.add(code); ch = true;
      for (const k of Object.keys(photos)) if (k.startsWith(code + '/')) { delete photos[k]; dirty.add('ph:' + k); }
    }
    if (ch) saveSoon(code);
  }
}, 3600e3);

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { clearTimeout(saveTimer); await Store.flush().catch(() => {}); process.exit(0); });

Store.load().then(() => {
  for (const r of Object.values(rooms)) for (const m of Object.values(r.markers || {}))
    if (typeof m.photo === 'string' && m.photo.startsWith('data:image/')) { photos[r.code + '/' + m.id] = m.photo; m.photo = String(Date.now()); dirty.add('ph:' + r.code + '/' + m.id); dirty.add(r.code); }
  vapid();
  server.listen(PORT, () => console.log('Medību serveris: http://localhost:' + PORT + ' · glabāšana: ' + (SB_URL && SB_KEY ? 'Supabase' : 'fails')));
});

module.exports = { encryptPush, vapidAuth }; // testiem
