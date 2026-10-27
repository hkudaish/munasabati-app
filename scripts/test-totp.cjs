// Authenticator second factor end to end: enrol, sign in with and without a code, replay protection, recovery codes, turn off.
// Needs the app running with AUTH_ENCRYPTION_KEY set (TEST_APP_URL, default http://localhost:3000) and the UserTotp migration applied.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { createHmac, randomBytes, scryptSync } = require('node:crypto');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient(), base = process.env.TEST_APP_URL || 'http://localhost:3000';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function fromBase32(t) { let bits = 0, v = 0; const out = []; for (const ch of t) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function code(secret, step) { const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(step)); const h = createHmac('sha1', fromBase32(secret)).update(m).digest(), o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0'); }
const nowStep = () => Math.floor(Date.now() / 30000);
const post = (path, data, cookie, ip = '198.51.100.9') => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(data) });
(async () => {
  const pw = 'Correct-Horse-Battery-9', salt = randomBytes(16).toString('hex'), tag = Date.now();
  const user = await db.user.create({ data: { name: 'TOTP test', phone: '059' + String(tag).slice(-7), email: `totp-${tag}@example.test`, role: 'VENDOR', passwordHash: `scrypt:${salt}:${scryptSync(pw, salt, 64).toString('hex')}` } });
  try {
    const id = user.email;
    let r = await post('/api/auth/login', { identifier: id, password: pw }); assert.equal(r.status, 200); assert.equal((await r.json()).success, true, 'password-only sign-in works before enrolling');
    const cookie = r.headers.get('set-cookie').split(';')[0];
    r = await fetch(base + '/api/auth/totp', { headers: { cookie } }); const status = await r.json(); assert.equal(status.available, true, 'server has AUTH_ENCRYPTION_KEY'); assert.equal(status.enabled, false);
    r = await post('/api/auth/totp', { action: 'setup' }, cookie); const setup = await r.json(); assert.equal(r.status, 200); assert.match(setup.secret, /^[A-Z2-7]{32}$/); assert.match(setup.qr, /^data:image\/png/);
    assert.equal((await post('/api/auth/totp', { action: 'enable', code: '000000' }, cookie)).status, 400, 'a wrong first code does not enable it');
    r = await post('/api/auth/totp', { action: 'enable', code: code(setup.secret, nowStep()) }, cookie); const enabled = await r.json(); assert.equal(r.status, 200); assert.equal(enabled.recoveryCodes.length, 10);
    // password alone is no longer enough
    r = await post('/api/auth/login', { identifier: id, password: pw }); assert.deepEqual(await r.json(), { success: false, mfaRequired: true });
    assert.equal((await post('/api/auth/login', { identifier: id, password: pw, code: '123456' })).status, 401, 'wrong code');
    assert.equal((await post('/api/auth/login', { identifier: id, password: pw, code: code(setup.secret, nowStep()) })).status, 401, 'the code used to enrol cannot be replayed');
    r = await post('/api/auth/login', { identifier: id, password: pw, code: code(setup.secret, nowStep() + 1) }); assert.equal(r.status, 200, 'the next code signs in'); assert.equal((await r.json()).success, true);
    assert.equal((await post('/api/auth/login', { identifier: id, password: pw, code: code(setup.secret, nowStep() + 1) })).status, 401, 'a code works once');
    const [first, second] = enabled.recoveryCodes;
    assert.equal((await post('/api/auth/login', { identifier: id, password: pw, code: first })).status, 200, 'a recovery code signs in');
    assert.equal((await post('/api/auth/login', { identifier: id, password: pw, code: first })).status, 401, 'a recovery code works once');
    // turning it off needs the password and a code
    assert.equal((await post('/api/auth/totp', { action: 'disable', password: 'wrong-password-123', code: second }, cookie)).status, 401);
    assert.equal((await post('/api/auth/totp', { action: 'disable', password: pw, code: second }, cookie)).status, 200);
    r = await post('/api/auth/login', { identifier: id, password: pw }, undefined, '198.51.100.10'); assert.equal((await r.json()).success, true, 'password-only again after turning it off');
    console.log('PASS totp: enrol, code required at sign-in, replay refused, recovery codes single use, turn off needs password and code.');
  } finally { await db.user.delete({ where: { id: user.id } }).catch(() => { }); await db.$disconnect(); }
})().catch(e => { console.error(e); process.exit(1); });
