// Medību komandas sinhronizācijas serveris — bez ārējām atkarībām (Node 18+).
// Palaišana:  node server.js   (PORT=8080 pēc noklusējuma)
// Pasniedz ./public mapi un nodrošina reāllaika API caur Server-Sent Events.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const MAX_CHAT = 300;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

// ---- Stāvoklis ----
let rooms = {}; // code -> {code,name,status,members,markers,chat,zone,created}
try { rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) {}
const clients = {}; // code -> Set(res)

let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(rooms), () => {});
  }, 1500);
}

function room(code) {
  code = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!code) return null;
  if (!rooms[code]) {
    rooms[code] = { code, name: 'Medības ' + code, status: 'plan', members: {}, markers: {}, chat: [], zone: [], created: Date.now() };
  }
  return rooms[code];
}

function broadcast(code, ev) {
  const set = clients[code];
  if (!set) return;
  const line = 'data: ' + JSON.stringify(ev) + '\n\n';
  for (const res of set) { try { res.write(line); } catch (_) {} }
}

// Notikuma pielietošana servera stāvoklim (tā pati loģika kā klientā)
function apply(r, ev) {
  const p = ev.payload || {};
  switch (ev.type) {
    case 'pos': case 'member':
      if (!p.id) return false;
      r.members[p.id] = Object.assign(r.members[p.id] || {}, p);
      return true;
    case 'leave':
      delete r.members[p.id]; return true;
    case 'marker':
      if (!p.id) return false;
      r.markers[p.id] = p; return true;
    case 'marker_del':
      delete r.markers[p.id]; return true;
    case 'chat':
      if (!p.id || r.chat.some(c => c.id === p.id)) return false;
      r.chat.push(p); if (r.chat.length > MAX_CHAT) r.chat.splice(0, r.chat.length - MAX_CHAT);
      return true;
    case 'zone':
      r.zone = Array.isArray(p.points) ? p.points.slice(0, 500) : []; return true;
    case 'sos':
      if (!p.id) return false;
      r.members[p.id] = Object.assign(r.members[p.id] || {}, { sos: !!p.active, lat: p.lat, lng: p.lng, t: p.t });
      return true;
    case 'hunt':
      if (p.name) r.name = String(p.name).slice(0, 80);
      if (p.status) r.status = p.status;
      return true;
  }
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 2e6) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => resolve(b));
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST' });
    return res.end();
  }

  if (parts[0] === 'api') {
    if (parts[1] === 'ping') return send(res, 200, { ok: true, t: Date.now() });

    if (parts[1] === 'hunt' && parts[2]) {
      const r = room(parts[2]);
      if (!r) return send(res, 400, { error: 'bad code' });

      // SSE straume
      if (parts[3] === 'stream' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*',
        });
        res.write('retry: 3000\n\n');
        res.write('data: ' + JSON.stringify({ type: 'snapshot', payload: r }) + '\n\n');
        (clients[r.code] = clients[r.code] || new Set()).add(res);
        const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (_) {} }, 20000);
        req.on('close', () => { clearInterval(ka); clients[r.code] && clients[r.code].delete(res); });
        return;
      }

      // Notikumu pieņemšana (viens vai masīvs)
      if (parts[3] === 'event' && req.method === 'POST') {
        try {
          const body = JSON.parse(await readBody(req));
          const list = Array.isArray(body) ? body : [body];
          let n = 0;
          for (const ev of list) {
            if (ev && typeof ev.type === 'string' && apply(r, ev)) { broadcast(r.code, ev); n++; }
          }
          if (n) saveSoon();
          return send(res, 200, { ok: true, applied: n });
        } catch (e) { return send(res, 400, { error: 'bad json' }); }
      }

      if (req.method === 'GET' && !parts[3]) return send(res, 200, r);
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
      // SPA rezerves variants
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(d2);
      });
    }
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (ext === '.js' || ext === '.html' || ext === '.webmanifest') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers); res.end(data);
  });
});

// Neaktīvu dalībnieku tīrīšana (> 24 h bez ziņām) un tukšu medību dzēšana (> 14 dienas)
setInterval(() => {
  const now = Date.now();
  for (const code of Object.keys(rooms)) {
    const r = rooms[code];
    for (const id of Object.keys(r.members)) if (now - (r.members[id].t || 0) > 864e5) delete r.members[id];
    const last = Math.max(r.created || 0, ...r.chat.map(c => c.t || 0), ...Object.values(r.markers).map(m => m.t || 0));
    if (now - last > 14 * 864e5 && !(clients[code] && clients[code].size)) delete rooms[code];
  }
  saveSoon();
}, 3600e3);

server.listen(PORT, () => console.log('Medību serveris darbojas: http://localhost:' + PORT));
