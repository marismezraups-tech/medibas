// Palaišana: node server.js (citā logā), tad: node tests/security.test.js
const B = process.env.BASE || 'http://localhost:8080', H = 'SEC' + Date.now().toString(36).slice(-5).toUpperCase();
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ s: r.status, b: await r.json().catch(() => null) }));
const get = u => fetch(B + u).then(async r => ({ s: r.status, b: await r.json().catch(() => null) }));
const ev = (id, t, events, k = '') => post(`/api/hunt/${H}/event`, { id, t, k, events });
const OT = 'owner-token-0123456789abcdef', BT = 'bob-token-0123456789abcdefgh', EVE = 'eve-token-0123456789abcdefgh';
(async () => {
  let fails = 0; const ok = (name, cond) => { if (!cond) fails++; console.log((cond ? '✅' : '❌') + ' ' + name); };
  await ev('owner', OT, [{ type: 'hunt', payload: { name: 'Drošība', claimOwner: true } }]);
  await ev('bob', BT, [{ type: 'pos', payload: { id: 'bob', name: 'Bobs', lat: 57, lng: 25, t: Date.now() } }]);
  let r = await get(`/api/hunt/${H}?id=owner&t=${OT}`); ok('vadītājs = owner', r.b.owner === 'owner');
  ok('atslēgas netiek publicētas', !('tokens' in r.b));
  // Eve uzdodas par vadītāju (zina ID, nezina atslēgu)
  r = await ev('owner', EVE, [{ type: 'kick', payload: { id: 'bob' } }]); ok('uzdošanās par vadītāju noraidīta (403)', r.s === 403 && r.b.error === 'token');
  r = await ev('owner', '', [{ type: 'hunt', payload: { pass: 'x' } }]); ok('bez atslēgas noraidīts', r.s === 403);
  // Eve kā parasts dalībnieks
  await ev('eve', EVE, [{ type: 'pos', payload: { id: 'eve', name: 'Eve', lat: 57, lng: 25, t: Date.now() } }]);
  r = await ev('eve', EVE, [{ type: 'kick', payload: { id: 'bob' } }]); ok('parasts dalībnieks nevar izslēgt', r.b.applied === 0 && r.b.rejected.includes('kick'));
  r = await ev('eve', EVE, [{ type: 'hunt', payload: { status: 'ended' } }]); ok('parasts dalībnieks nevar beigt medības', r.b.applied === 0);
  r = await ev('eve', EVE, [{ type: 'chat', payload: { id: 'c1', from: 'bob', name: 'Bobs', text: 'viltots', t: 1 } }]); ok('nevar rakstīt cita vārdā', r.b.applied === 0);
  // torņi
  r = await ev('owner', OT, [{ type: 'marker', payload: { id: 's1', type: 'stand', name: 'T-1', lat: 57, lng: 25, dir: 0, arc: 90, range: 250, by: 'owner' } }]); ok('vadītājs izveido torni', r.b.applied === 1);
  r = await ev('eve', EVE, [{ type: 'marker', payload: { id: 's2', type: 'stand', name: 'X', lat: 57, lng: 25, by: 'eve' } }]); ok('dalībnieks nevar izveidot torni', r.b.applied === 0);
  r = await ev('eve', EVE, [{ type: 'marker', payload: { id: 's1', type: 'stand', name: 'T-1', lat: 57, lng: 25, dir: 180, arc: 90, range: 250, by: 'owner' } }]); ok('dalībnieks nevar pagriezt sektoru', r.b.applied === 0);
  r = await ev('eve', EVE, [{ type: 'marker', payload: { id: 's1', type: 'stand', name: 'T-1', lat: 57, lng: 25, dir: 0, arc: 90, range: 250, by: 'owner', assigned: 'eve', updatedBy: 'eve' } }]); ok('dalībnieks var ieņemt brīvu torni', r.b.applied === 1);
  r = await ev('bob', BT, [{ type: 'marker', payload: { id: 's1', type: 'stand', name: 'T-1', lat: 57, lng: 25, dir: 0, arc: 90, range: 250, by: 'owner', assigned: 'bob' } }]); ok('nevar atņemt aizņemtu torni', r.b.applied === 0);
  r = await ev('eve', EVE, [{ type: 'marker_del', payload: { id: 's1' } }]); ok('dalībnieks nevar dzēst torni', r.b.applied === 0);
  r = await ev('eve', EVE, [{ type: 'zone', payload: { points: [[1, 1]] } }]); ok('dalībnieks nevar mainīt zonu', r.b.applied === 0);
  // novērojumi
  await ev('bob', BT, [{ type: 'marker', payload: { id: 'o1', type: 'obs', lat: 57, lng: 25, by: 'bob', species: 'Alnis' } }]);
  r = await ev('eve', EVE, [{ type: 'marker_del', payload: { id: 'o1' } }]); ok('nevar dzēst cita novērojumu', r.b.applied === 0);
  r = await ev('bob', BT, [{ type: 'marker', payload: { id: 'o1', type: 'obs', lat: 57, lng: 25, by: 'bob', species: 'Stirna' } }]); ok('var labot savu novērojumu', r.b.applied === 1);
  r = await ev('owner', OT, [{ type: 'marker_del', payload: { id: 'o1' } }]); ok('vadītājs var dzēst jebko', r.b.applied === 1);
  // palīgs
  await ev('owner', OT, [{ type: 'hunt', payload: { admins: ['bob'] } }]);
  r = await ev('bob', BT, [{ type: 'zone', payload: { points: [[57, 25], [57.1, 25], [57.1, 25.1]] } }]); ok('palīgs var mainīt zonu', r.b.applied === 1);
  r = await ev('bob', BT, [{ type: 'hunt', payload: { pass: 'nozagts' } }]); r = await get(`/api/hunt/${H}/info`); ok('palīgs nevar iestatīt paroli', !r.b.hasPass);
  // foto atsevišķi
  const img = 'data:image/jpeg;base64,' + Buffer.alloc(3000, 7).toString('base64');
  await ev('bob', BT, [{ type: 'marker', payload: { id: 'p1', type: 'obs', lat: 57, lng: 25, by: 'bob', photo: img } }]);
  r = await get(`/api/hunt/${H}?id=bob&t=${BT}`); ok('foto nav medību datos (tikai karodziņš)', r.b.markers.p1.photo && !String(r.b.markers.p1.photo).startsWith('data:') && JSON.stringify(r.b).length < 5000);
  const ph = await fetch(`${B}/api/hunt/${H}/photo/p1?id=bob&t=${BT}`); ok('foto ielādējas atsevišķi (' + ph.headers.get('content-type') + ', ' + (await ph.arrayBuffer()).byteLength + ' B)', ph.status === 200);
  r = await ev('bob', BT, [{ type: 'marker', payload: { id: 'p1', type: 'obs', lat: 57, lng: 25, by: 'bob', species: 'Lapsa', photo: r.b.markers.p1.photo } }]);
  ok('foto saglabājas pēc labošanas', (await fetch(`${B}/api/hunt/${H}/photo/p1?id=bob&t=${BT}`)).status === 200);
  // trackeris ar atslēgu
  await ev('owner', OT, [{ type: 'tracker', payload: { dev: 'dog1', name: 'Reksis', key: 'slepenaatslega12' } }]);
  r = await get(`/api/hunt/${H}?id=owner&t=${OT}`); ok('trackera atslēga netiek publicēta', r.b.trackers.dog1.secured && !('keyHash' in r.b.trackers.dog1));
  ok('trackeris bez atslēgas noraidīts', (await (await fetch(B + '/?id=dog1&lat=57&lon=25')).text()) === 'UNKNOWN DEVICE');
  ok('trackeris ar nepareizu atslēgu noraidīts', (await (await fetch(B + '/api/tracker/nepareiza?id=dog1&lat=57&lon=25')).text()) === 'UNKNOWN DEVICE');
  ok('trackeris ar atslēgu pieņemts', (await (await fetch(B + '/api/tracker/slepenaatslega12?id=dog1&lat=57.01&lon=25.01')).text()) === 'OK');
  r = await ev('eve', EVE, [{ type: 'tracker', payload: { dev: 'dog1', name: 'Viltus', key: 'x' } }]); ok('dalībnieks nevar mainīt trackeri', r.b.applied === 0);
  // izslēgšana
  r = await ev('owner', OT, [{ type: 'kick', payload: { id: 'eve' } }]); ok('vadītājs izslēdz', r.b.applied === 1);
  r = await ev('eve', EVE, [{ type: 'pos', payload: { id: 'eve', lat: 1, lng: 1 } }]); ok('izslēgtais vairs netiek iekšā', r.s === 403 && r.b.error === 'banned');
  console.log(fails ? fails + ' pārbaudes neizdevās' : 'Visas pārbaudes izdevās'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
