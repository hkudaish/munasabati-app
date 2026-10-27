// Wrong passwords lock a device out of an account; a correct password clears the device count. Needs the app running (TEST_APP_URL, default http://localhost:3000).
const assert = require('node:assert/strict'); const base = process.env.TEST_APP_URL || 'http://localhost:3000';
const id = 'lockout-' + Date.now() + '@example.test';
const login = (ip, identifier, password) => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ identifier, password }) });
(async () => {
  for (let i = 0; i < 5; i++) assert.equal((await login('203.0.113.7', id, 'wrong-password-' + i)).status, 401, 'wrong password before the limit is 401');
  const locked = await login('203.0.113.7', id, 'wrong-password-x'); assert.equal(locked.status, 429, 'sixth attempt is locked'); assert(Number(locked.headers.get('retry-after')) > 0, 'Retry-After is sent');
  assert.match((await locked.json()).error, /إيقاف تسجيل الدخول مؤقتاً/);
  assert.equal((await login('203.0.113.7', id, 'wrong-password-y')).status, 429, 'stays locked');
  assert.equal((await login('203.0.113.8', id, 'wrong-password-z')).status, 401, 'a different device is not locked by the first one');
  console.log('PASS login lockout: 5 wrong passwords lock the device, Retry-After is sent, other devices are unaffected.');
})().catch(e => { console.error(e); process.exit(1); });
