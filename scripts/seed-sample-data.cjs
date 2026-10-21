// Sample vendors, customers and a ready-to-buy catalog for LOCAL development and demos.
//
//   1. start the app against your local database (npm run build && npx next start -p 3000, or npm run dev)
//   2. node scripts/seed-sample-data.cjs [--base http://localhost:3000]
//
// Safe by design: refuses any database that is not on localhost, only touches records whose ids/emails start
// with "sample" (re-running is idempotent), and builds the catalog through the app's own APIs as each vendor,
// so every record passes the same validation as real data. Sample accounts all use SAMPLE_PASSWORD
// (default below). They exist only in your local database; never run this against production.
const fs = require('node:fs');
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const dbUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname)) { console.error('Refusing: DATABASE_URL is not a local database.'); process.exit(1); }

const baseArg = process.argv.indexOf('--base');
const BASE = (baseArg > 0 ? process.argv[baseArg + 1] : 'http://localhost:3000').replace(/\/$/, '');
const PASSWORD = process.env.SAMPLE_PASSWORD || 'Sample-Pass-2026!';
const DOMAIN = '@sample.munasabati.test';
const prisma = new PrismaClient();

const IMG = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
  party: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
  grad: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&auto=format&fit=crop&q=80',
  balloons: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&auto=format&fit=crop&q=80',
  table: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
  flowers: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&auto=format&fit=crop&q=80',
  stage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
};

// ---- people --------------------------------------------------------------------------------
const CUSTOMERS = [
  { name: 'نورة العتيبي', email: 'noura' + DOMAIN, phone: '0551000001', cityId: 'riyadh' },
  { name: 'فيصل الدوسري', email: 'faisal' + DOMAIN, phone: '0551000002', cityId: 'jeddah' },
  { name: 'ريم الشمري', email: 'reem' + DOMAIN, phone: '0551000003', cityId: 'dammam' },
  { name: 'عبدالله القحطاني', email: 'abdullah' + DOMAIN, phone: '0551000004', cityId: 'riyadh' },
];
const VENDORS = [
  { key: 'lens', business: 'استوديو عدسة الفخامة', en: 'Fakhama Lens Studio', category: 'photography', city: 'riyadh', phone: '0552000001', bio: 'تصوير فوتوغرافي وسينمائي لحفلات الزفاف والتخرج بأحدث الكاميرات وطاقم نسائي ورجالي.' },
  { key: 'feast', business: 'ضيافة الكرم الأصيل', en: 'Alkaram Hospitality', category: 'hospitality', city: 'riyadh', phone: '0552000002', bio: 'بوفيهات وضيافة سعودية فاخرة وقهوجيين وصبابين لجميع المناسبات.' },
  { key: 'bloom', business: 'كوشة وورد الياسمين', en: 'Jasmine Decor', category: 'decor', city: 'riyadh', phone: '0552000003', bio: 'كوش وتنسيق ورد وتصاميم ديكور مخصصة لحفلات الزفاف والخطوبة.' },
  { key: 'hall', business: 'قصر الأميرة للاحتفالات', en: 'Princess Palace Hall', category: 'hall', city: 'riyadh', phone: '0552000004', bio: 'قاعة أفراح فاخرة تتسع لـ 600 ضيف مع مواقف وخدمات متكاملة.' },
  { key: 'beats', business: 'نغم للترفيه والصوتيات', en: 'Nagham Entertainment', category: 'entertainment', city: 'jeddah', phone: '0552000005', bio: 'دي جي ومهندس صوت وفرق ترفيه وزفات عصرية.' },
  { key: 'sweet', business: 'حلويات وكيك لمسة سكر', en: 'Sugar Touch', category: 'cake', city: 'jeddah', phone: '0552000006', bio: 'كيك مناسبات وتوزيعات حلويات مصممة حسب الطلب.' },
];

// Prices are in halalas (100 halalas = 1 SAR). VAT 15% is added by the server.
const policy = (o = {}) => ({ baseAmount: 100000, bookingMode: 'DIRECT', durationMinutes: 240, minDurationMinutes: 60, maxDurationMinutes: 2880, depositBps: 3000, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 7000, beforeHours: 48 }], calendar: { minNoticeHours: 24, bufferMinutes: 30 }, ...o });
const CATALOG = {
  lens: [
    { id: 'sample-lens-wedding', title: 'تغطية تصوير زفاف كاملة', desc: 'تصوير فوتوغرافي وفيديو سينمائي للحفل من الاستقبال حتى الزفة، مع ألبوم فاخر ومقاطع قصيرة.', images: [IMG.wedding],
      offers: [{ id: 'sample-lens-wedding-full', name: 'باقة الليلة الكاملة', model: 'FIXED', policy: policy({ baseAmount: 450000, durationMinutes: 480 }) },
               { id: 'sample-lens-wedding-hour', name: 'تغطية بالساعة', model: 'HOURLY', policy: policy({ baseAmount: 60000, durationMinutes: 180, minDurationMinutes: 120 }) }] },
    { id: 'sample-lens-grad', title: 'تصوير حفلات التخرج', desc: 'تغطية سريعة لحفلات التخرج مع صور فورية وطباعة.', images: [IMG.grad],
      offers: [{ id: 'sample-lens-grad-fixed', name: 'باقة التخرج', model: 'FIXED', policy: policy({ baseAmount: 120000, durationMinutes: 180 }) }] },
  ],
  feast: [
    { id: 'sample-feast-buffet', title: 'بوفيه ضيافة سعودية فاخرة', desc: 'بوفيه مفتوح مع قهوة سعودية وتمور وحلويات، يشمل الطاقم والتجهيز.', images: [IMG.table],
      offers: [{ id: 'sample-feast-buffet-fixed', name: 'بوفيه 100 ضيف', model: 'FIXED', policy: policy({ baseAmount: 850000, durationMinutes: 300 }) }] },
    { id: 'sample-feast-coffee', title: 'قهوجيون وصبابات', desc: 'طاقم قهوجيين وصبابات مدرب لخدمة الضيوف.', images: [IMG.party],
      offers: [{ id: 'sample-feast-coffee-hour', name: 'طاقم ضيافة بالساعة', model: 'HOURLY', policy: policy({ baseAmount: 35000, durationMinutes: 240, minDurationMinutes: 180 }) }] },
  ],
  bloom: [
    { id: 'sample-bloom-kosha', title: 'كوشة زفاف ملكية', desc: 'تصميم كوشة مع ورد طبيعي وإضاءة وتنسيق مدخل القاعة.', images: [IMG.flowers],
      offers: [{ id: 'sample-bloom-kosha-fixed', name: 'كوشة ملكية كاملة', model: 'FIXED', policy: policy({ baseAmount: 650000, durationMinutes: 480 }) },
               { id: 'sample-bloom-kosha-quote', name: 'تصميم مخصص (عرض سعر)', model: 'STARTING_AT', policy: policy({ baseAmount: 300000, bookingMode: 'QUOTE', durationMinutes: 480 }) }] },
  ],
  hall: [
    { id: 'sample-hall-wedding', title: 'قاعة أفراح قصر الأميرة', desc: 'قاعة فاخرة تتسع لـ 600 ضيف مع قسم نسائي مستقل ومواقف وخدمات متكاملة.', images: [IMG.wedding], sub: 'wedding-halls',
      offers: [{ id: 'sample-hall-night', name: 'حجز الليلة', model: 'NIGHT', policy: policy({ baseAmount: 1800000, durationMinutes: 720, depositBps: 4000, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 6000, beforeHours: 72 }] }) }] },
  ],
  beats: [
    { id: 'sample-beats-dj', title: 'دي جي وتجهيز صوتي', desc: 'دي جي محترف مع نظام صوت وإضاءة تناسب الحفلات الخاصة.', images: [IMG.stage], sub: 'event-dj',
      offers: [{ id: 'sample-beats-dj-hour', name: 'دي جي بالساعة', model: 'HOURLY', policy: policy({ baseAmount: 90000, durationMinutes: 240, minDurationMinutes: 180 }) }] },
  ],
  sweet: [
    { id: 'sample-sweet-cake', title: 'كيك مناسبات مصمم حسب الطلب', desc: 'كيك بتصميم خاص ونكهات متعددة مع توصيل وتغليف فاخر.', images: [IMG.balloons],
      offers: [{ id: 'sample-sweet-cake-fixed', name: 'كيك 3 طوابق', model: 'FIXED', policy: policy({ baseAmount: 85000, durationMinutes: 60, minDurationMinutes: 30, calendar: { minNoticeHours: 48, bufferMinutes: 0 } }) }] },
  ],
};

// ---- helpers -------------------------------------------------------------------------------
async function hash(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await promisify(scrypt)(password, salt, 64)).toString('hex')}`;
}
async function call(path, method = 'GET', data, cookie) {
  const res = await fetch(BASE + path, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let body = {}; try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
async function login(email) {
  const r = await call('/api/auth/login', 'POST', { identifier: email, password: PASSWORD });
  if (r.status !== 200) throw new Error('login failed for ' + email + ': ' + JSON.stringify(r.body));
  return r.cookie;
}
async function ensureUser(data) {
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: data.email }, { phone: data.phone }] } });
  if (existing) return { user: existing, created: false };
  const user = await prisma.user.create({ data: { ...data, passwordHash: await hash(PASSWORD), isActive: true } });
  return { user, created: true };
}

(async () => {
  const ping = await fetch(BASE + '/api/health/db').catch(() => null);
  if (!ping || !ping.ok) throw new Error('The app is not reachable at ' + BASE + '. Start it against your local database first.');
  const summary = { customers: 0, vendors: 0, services: 0, offers: 0, packages: 0 };

  // admin (needed to create multi-vendor packages)
  const adminAccount = await ensureUser({ name: 'مدير العينات', email: 'admin' + DOMAIN, phone: '0551000099', role: 'SUPER_ADMIN', cityId: 'riyadh' });
  // a second administrator: payments must be reviewed independently of whoever recorded them
  await ensureUser({ name: 'مراجع العينات', email: 'admin2' + DOMAIN, phone: '0551000098', role: 'ADMIN', cityId: 'riyadh' });
  // customers
  for (const c of CUSTOMERS) { const r = await ensureUser({ name: c.name, email: c.email, phone: c.phone, role: 'CLIENT', cityId: c.cityId }); if (r.created) summary.customers++; }

  // vendors + their catalog
  const offerIds = {};
  for (const v of VENDORS) {
    const { user, created } = await ensureUser({ name: v.business, email: v.key + '.vendor' + DOMAIN, phone: v.phone, role: 'VENDOR', cityId: v.city });
    let vendor = await prisma.vendor.findFirst({ where: { userId: user.id } });
    if (!vendor) {
      vendor = await prisma.vendor.create({ data: { userId: user.id, businessName: v.business, businessNameEn: v.en, categoryId: v.category, cityId: v.city, logo: IMG.party, bannerImage: IMG.wedding, neighborhood: 'وسط المدينة', bioAr: v.bio, cancellationPolicyAr: 'إلغاء مجاني حتى 7 أيام قبل الموعد.', contactPhone: v.phone, whatsappNumber: v.phone, status: 'ACTIVE' } });
      summary.vendors++;
    }
    const cookie = await login(v.key + '.vendor' + DOMAIN);
    const existing = await call('/api/commerce/manage', 'GET', undefined, cookie);
    const haveService = new Set((existing.body.services || []).map(s => s.id));
    const haveOffer = new Set((existing.body.offers || []).map(o => o.id));
    for (const s of CATALOG[v.key]) {
      let serviceId = s.id;
      if (!haveService.has(s.id)) {
        const r = await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: s.id, body: { titleAr: s.title, descriptionAr: s.desc, kind: 'BOOKABLE', categoryId: v.category, subcategoryId: s.sub || null, artistId: null, cities: [v.city], managerIds: [user.id], resourceIds: [], published: true, approved: true, images: s.images, videoUrls: [] } }, cookie);
        if (r.status !== 200) throw new Error('service ' + s.id + ' failed: ' + r.status + ' ' + JSON.stringify(r.body));
        summary.services++;
      }
      for (const o of s.offers) {
        offerIds[o.id] = o.id;
        if (haveOffer.has(o.id)) continue;
        const r = await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: o.id, serviceId, body: { nameAr: o.name, model: o.model, enabled: true, allowPackages: true, holdMinutes: 15, policy: o.policy } }, cookie);
        if (r.status !== 200) throw new Error('offer ' + o.id + ' failed: ' + r.status + ' ' + JSON.stringify(r.body));
        summary.offers++;
      }
    }
  }

  // The administrator approves vendor-submitted services (vendors cannot approve themselves).
  const adminCookie = await login('admin' + DOMAIN);
  const pending = ((await call('/api/commerce/manage', 'GET', undefined, adminCookie)).body.services || []).filter(sv => sv.id.startsWith('sample-') && !sv.body.approved);
  for (const sv of pending) {
    const r = await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: sv.id, version: sv.version, body: { ...sv.body, approved: true } }, adminCookie);
    if (r.status !== 200) throw new Error('approving ' + sv.id + ' failed: ' + r.status + ' ' + JSON.stringify(r.body));
    summary.approved = (summary.approved || 0) + 1;
  }

  // multi-vendor packages (admin)
  const adminView = await call('/api/commerce/manage', 'GET', undefined, adminCookie);
  const havePackage = new Set((adminView.body.packages || []).map(p => p.id));
  const packages = [
    { id: 'sample-package-wedding', name: 'باقة الزفاف المتكاملة', desc: 'قاعة وكوشة وتصوير وضيافة بخصم 8% على المجموع.', discountBps: 800, items: ['sample-hall-night', 'sample-bloom-kosha-fixed', 'sample-lens-wedding-full', 'sample-feast-buffet-fixed'] },
    { id: 'sample-package-grad', name: 'باقة التخرج السريعة', desc: 'تصوير وكيك ودي جي لحفلة تخرج مميزة.', discountBps: 500, items: ['sample-lens-grad-fixed', 'sample-sweet-cake-fixed', 'sample-beats-dj-hour'] },
  ];
  for (const p of packages) {
    if (havePackage.has(p.id)) continue;
    const r = await call('/api/commerce/manage', 'POST', { kind: 'PACKAGE', id: p.id, body: { nameAr: p.name, descriptionAr: p.desc, published: true, discountBps: p.discountBps, kind: 'CUSTOMIZABLE' }, items: p.items.map((offerId, i) => ({ id: p.id + '-' + i, offerId, quantity: 1, durationMinutes: 240, optional: false, substitutions: [] })) }, adminCookie);
    if (r.status !== 200) throw new Error('package ' + p.id + ' failed: ' + r.status + ' ' + JSON.stringify(r.body));
    summary.packages++;
  }

  const catalog = await call('/api/commerce/catalog');
  console.log('Created now :', JSON.stringify(summary));
  console.log('In catalog  :', catalog.body.services?.length + ' services, ' + catalog.body.offers?.length + ' offers, ' + catalog.body.packages?.length + ' packages');
  console.log('\nSample accounts (password for all: ' + PASSWORD + ')');
  console.log('  admin    : admin' + DOMAIN + '  (super admin)');
  console.log('  admin    : admin2' + DOMAIN + '  (second administrator, reviews payments)');
  for (const c of CUSTOMERS) console.log('  customer : ' + c.email + '  (' + c.name + ')');
  for (const v of VENDORS) console.log('  vendor   : ' + v.key + '.vendor' + DOMAIN + '  (' + v.business + ')');
  void adminAccount;
})().catch(e => { console.error('Seed failed:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
