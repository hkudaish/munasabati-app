// Integration tests against a running local app and its PostgreSQL database.
// Creates isolated temporary users; never sends external messages.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const fs = require('node:fs');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); const users = []; const sourceKeys = [];
const base = process.env.TEST_APP_URL || 'http://localhost:3000';
async function call(path, method = 'GET', data, cookie, origin) {
  const response = await fetch(base + path, { method, headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  return { status: response.status, data: result, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
(async () => {
  assert.equal((await call('/api/occasions')).status, 401);
  assert.equal((await call('/api/channel-settings')).status, 401);
  const password = randomBytes(24).toString('base64url');
  async function register() {
    const phone = '05' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'); sourceKeys.push(phone);
    const result = await call('/api/auth/register', 'POST', { userType: 'client', customerData: { name: 'اختبار قاعدة بيانات', cityId: 'riyadh', phone, password } });
    assert.equal(result.status, 200, JSON.stringify(result.data)); users.push(result.data.user.id);
    assert(result.headers.get('set-cookie').includes('HttpOnly')); assert(result.headers.get('set-cookie').includes('SameSite=lax'));
    return { ...result, phone };
  }
  const a = await register(), b = await register();
  assert.equal((await call('/api/auth/login', 'POST', { identifier: a.phone, password: 'wrong', requestedRole: 'admin' })).status, 401);
  assert.equal((await call('/api/auth/login', 'POST', { identifier: 'admin', requestedRole: 'admin' })).status, 401);
  const login = await call('/api/auth/login', 'POST', { identifier: a.phone, password, requestedRole: 'admin' });
  assert.equal(login.status, 200); assert.equal(login.data.user.role, 'client');
  const input = { title: 'حفل اختبار 🤍', occasionTypeId: 'wedding', occasionTypeNameAr: 'زواج', cityId: 'riyadh', date: '2026-12-01', guestsSection: 'families', tier: 'ultra_luxury', venueType: 'farm' };
  assert.equal((await call('/api/occasions', 'POST', input, a.cookie, 'https://evil.example')).status, 403);
  const created = await call('/api/occasions', 'POST', input, a.cookie); assert.equal(created.status, 200, JSON.stringify(created.data)); const occasion = created.data.occasion;
  assert.equal(occasion.shareCode.length, 43);
  assert.equal((await call(`/api/occasions/${occasion.id}`, 'PATCH', { title: 'hacked' }, b.cookie)).status, 404);
  const createdGuest = await call(`/api/occasions/${occasion.id}/guests`, 'POST', { name: 'ضيف الاختبار', phone: '0501234567', email: 'test@example.com', category: 'family', companionCount: 2, invitedVia: 'email' }, a.cookie);
  assert.equal(createdGuest.status, 200, JSON.stringify(createdGuest.data)); const guest = createdGuest.data.guest;
  assert.equal(guest.invitationSentAt, null); assert.equal(guest.qrCode.length, 43);
  const publicRead = await call(`/api/invitations/${guest.qrCode}`);
  assert.equal(publicRead.status, 200); assert.equal(publicRead.data.guest.name, guest.name);
  assert(!JSON.stringify(publicRead.data).includes(guest.phone)); assert(!JSON.stringify(publicRead.data).includes(guest.email));
  assert.equal((await call('/api/invitations/MUN-GST-101-01')).status, 404);
  assert.equal((await call(`/api/invitations/${occasion.shareCode}`, 'POST', { status: 'confirmed' })).status, 400);
  assert.equal((await call(`/api/invitations/${guest.qrCode}`, 'POST', { status: 'confirmed', companionCount: 3 })).status, 400);
  assert.equal((await call(`/api/invitations/${guest.qrCode}`, 'POST', { status: 'confirmed', companionCount: 1, congratsMessage: 'ألف مبروك' })).status, 200);
  const fromOtherSession = await call('/api/occasions', 'GET', undefined, login.cookie);
  assert.equal(fromOtherSession.data.guests.find(g => g.id === guest.id).status, 'confirmed');
  const savedGuest = await prisma.guest.findUniqueOrThrow({ where: { id: guest.id } }); assert.equal(savedGuest.rsvpCompanionCount, 1); assert(savedGuest.rsvpTime); assert.equal(savedGuest.congratulation, 'ألف مبروك');
  assert.equal((await call('/api/occasions', 'GET', undefined, b.cookie)).data.guests.length, 0);
  assert.equal((await call(`/api/guests/${guest.id}`, 'PATCH', { status: 'attended' }, b.cookie)).status, 404);
  const scans = await Promise.all([1,2].map(() => call(`/api/guests/${guest.id}`, 'PATCH', { status: 'attended' }, a.cookie)));
  assert.deepEqual(scans.map(s => s.status).sort(), [200,409]);
  assert.equal((await call(`/api/invitations/${guest.qrCode}`, 'POST', { status: 'declined', companionCount: 0 })).status, 409);
  // Draft concurrency and server-side template permissions.
  const ts = require('typescript'); require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  const { DEFAULT_DESIGN, BUILTIN_TEMPLATES } = require('../src/lib/invitations/catalog.ts');
  const draft = { action: 'draft', occasionId: occasion.id, version: 0, design: DEFAULT_DESIGN };
  assert.equal((await call('/api/invitation-studio','POST', draft, a.cookie)).status, 200);
  assert.equal((await call('/api/invitation-studio','POST', draft, a.cookie)).status, 409);
  assert.equal((await call(`/api/invitation-studio?occasionId=${occasion.id}`, 'GET', undefined, b.cookie)).status, 404);
  let template = { ...BUILTIN_TEMPLATES[0], id: randomUUID(), ownerId: a.data.user.id, status: 'private', version: 1 };
  assert.equal((await call('/api/invitation-studio','POST',{action:'template',template},a.cookie)).status,200);
  assert.equal((await call('/api/invitation-studio','POST',{action:'template',template:{...template,status:'published'},expectedVersion:1},a.cookie)).status,403);
  assert.equal((await call('/api/invitation-studio','POST',{action:'template',template:{...template,ownerId:b.data.user.id},expectedVersion:1},b.cookie)).status,403);
  assert.equal((await call('/api/invitation-studio','POST',{action:'template',template:{...template,status:'pending'},expectedVersion:1},a.cookie)).status,200);
  assert.equal((await call('/api/invitation-studio','POST',{action:'template',template,expectedVersion:2},a.cookie)).status,403);
  // Legacy data is copied to the signed-in owner atomically and imports are retry-safe.
  const legacy = { ...input, id: 'legacy-test', occasionTypeNameAr: 'زواج' };
  const oldGuest = { name: 'ضيف سابق', phone: '0501234567', category: 'family', companionCount: 0, invitedVia: 'whatsapp', occasionId: legacy.id, status: 'confirmed' };
  const imported = await call('/api/invitations/import','POST',{confirmOwnership:true,occasion:legacy,guests:[oldGuest]},a.cookie);
  assert.equal(imported.status,200,JSON.stringify(imported.data));
  const again = await call('/api/invitations/import','POST',{confirmOwnership:true,occasion:legacy,guests:[oldGuest]},a.cookie);
  assert.equal(again.data.occasionId,imported.data.occasionId); assert.equal(again.data.alreadyImported,true);
  assert.equal(await prisma.guest.count({where:{occasionId:imported.data.occasionId}}),1);
  assert.equal((await call('/api/invitations/import','POST',{confirmOwnership:false,occasion:legacy,guests:[]},a.cookie)).status,400);
  // Secret is encrypted at rest and write-only through HTTP; disabled channel cannot send.
  const secret = 'test-secret-' + randomUUID();
  assert.equal((await call('/api/channel-settings','PUT',{channel:'email',enabled:false,config:{from:'sender@example.com'},secret},a.cookie)).status,200);
  const setting = await prisma.channelSetting.findUniqueOrThrow({where:{userId_channel:{userId:a.data.user.id,channel:'email'}}});
  assert(!setting.encryptedSecret.includes(secret)); assert(setting.encryptedSecret.startsWith('v1:'));
  const settings = await call('/api/channel-settings','GET',undefined,a.cookie); assert(!JSON.stringify(settings.data).includes(secret)); assert(!JSON.stringify(settings.data).includes(setting.encryptedSecret));
  assert.equal((await call('/api/channel-settings','GET',undefined,b.cookie)).data.settings.length,0);
  const requestKey=randomUUID(); assert.equal((await call(`/api/guests/${guest.id}/send`,'POST',{channel:'email',requestKey},a.cookie)).status,400);
  assert.equal(await prisma.invitationDelivery.count({where:{guestId:guest.id}}),0);
  // Retrying a previously accepted request never contacts a provider again.
  const acceptedKey = randomUUID();
  await prisma.invitationDelivery.create({data:{guestId:guest.id,channel:'email',requestKey:acceptedKey,status:'ACCEPTED',providerId:'test-accepted'}});
  const retry = await call(`/api/guests/${guest.id}/send`,'POST',{channel:'email',requestKey:acceptedKey},a.cookie);
  assert.equal(retry.status,200); assert.equal(retry.data.delivery.providerId,'test-accepted');
  assert.equal(await prisma.invitationDelivery.count({where:{requestKey:acceptedKey}}),1);
  await call(`/api/guests/${guest.id}`,'PATCH',{revoke:true},a.cookie);
  assert.equal((await call(`/api/invitations/${guest.qrCode}`)).status,410);
  await call('/api/auth/logout','POST',{},a.cookie);
  assert.equal((await call('/api/occasions','GET',undefined,a.cookie)).status,401);
  console.log('PASS: authenticated ownership, CSRF, private invitation data, durable RSVP, atomic check-in, draft conflicts, template permissions, encrypted settings, disabled sends and session revocation.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  // Delete only records created by this test run.
  if (users.length) {
    await prisma.invitationFavorite.deleteMany({where:{userId:{in:users}}});
    await prisma.occasion.deleteMany({where:{userId:{in:users}}});
    await prisma.user.deleteMany({where:{id:{in:users}}});
  }
  await prisma.$disconnect();
});
