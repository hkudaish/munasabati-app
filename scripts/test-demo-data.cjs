// Admin demo data: add, idempotent re-add, remove (needs the app running against a LOCAL database with the sample admin: npm run db:seed-sample once).
const assert = require('node:assert/strict');
const base = process.env.TEST_APP_URL || 'http://localhost:3000', ip = '198.51.100.31';
const req = (path, method, data, cookie) => fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
(async () => {
  let r = await req('/api/auth/login', 'POST', { identifier: 'admin@sample.munasabati.test', password: process.env.SAMPLE_PASSWORD || 'Sample-Pass-2026!' });
  assert.equal(r.status, 200, 'sample admin sign-in'); const cookie = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/api/admin/demo-data', 'GET')).status, 401, 'signed out is refused');
  let st = await (await req('/api/admin/demo-data', 'GET', null, cookie)).json();
  r = await req('/api/admin/demo-data', 'POST', { action: 'remove' }, cookie); assert.equal(r.status, 200, 'remove ' + await r.clone().text()); const removed = await r.json();
  let cat = await (await req('/api/commerce/catalog', 'GET')).json();
  assert.equal(cat.services.filter(s => s.id.startsWith('sample-')).length, 0, 'no demo service is visible after removing');
  assert.equal(cat.packages.filter(p => p.id.startsWith('sample-')).length, 0, 'no demo package is visible after removing');
  st = await (await req('/api/admin/demo-data', 'GET', null, cookie)).json(); if (!removed.kept) assert.equal(st.services + st.offers + st.vendors, 0, 'deleted outright');
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < st.steps; i++) { r = await req('/api/admin/demo-data', 'POST', { action: 'seed', step: i }, cookie); assert.equal(r.status, 200, `seed step ${i}: ` + await r.clone().text()); }
  st = await (await req('/api/admin/demo-data', 'GET', null, cookie)).json(); assert.ok(st.services >= 14 && st.vendors >= 7 && st.packages >= 2, 'all demo data is back');
  cat = await (await req('/api/commerce/catalog', 'GET')).json(); assert.ok(cat.services.filter(s => s.id.startsWith('sample-')).length >= 14 && cat.packages.filter(p => p.id.startsWith('sample-')).length >= 2, 'visible in the public catalog again');
  console.log('removal result:', JSON.stringify(removed));
  console.log('PASS demo data: add, repeat is idempotent, visible publicly, remove clears it. Left in place:', JSON.stringify(st));
})().catch(e => { console.error(e); process.exit(1); });
