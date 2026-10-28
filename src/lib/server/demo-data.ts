import 'server-only';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { digest } from '@/lib/server/auth';

// Demo vendors, services, offers and packages for showing the marketplace before real vendors join.
// Everything is created through the app's own commerce API (as each demo vendor, and as the administrator who starts it),
// so it passes the same validation as real data. Every record is recognisable by an id starting "sample-" or an
// e-mail ending in DOMAIN, which is exactly what removal deletes. Demo vendors have no password, so nobody can sign in as one.
export const DOMAIN = '@sample.munasabati.test';
const IMG = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
  party: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
  grad: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&auto=format&fit=crop&q=80',
  balloons: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&auto=format&fit=crop&q=80',
  table: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
  flowers: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&auto=format&fit=crop&q=80',
  stage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
};
const VENDORS = [
  { key: 'lens', business: 'استوديو عدسة الفخامة', en: 'Fakhama Lens Studio', category: 'photography', city: 'riyadh', phone: '0552000001', bio: 'تصوير فوتوغرافي وسينمائي لحفلات الزفاف والتخرج بأحدث الكاميرات وطاقم نسائي ورجالي.' },
  { key: 'feast', business: 'ضيافة الكرم الأصيل', en: 'Alkaram Hospitality', category: 'hospitality', city: 'riyadh', phone: '0552000002', bio: 'بوفيهات وضيافة سعودية فاخرة وقهوجيين وصبابين لجميع المناسبات.' },
  { key: 'bloom', business: 'كوشة وورد الياسمين', en: 'Jasmine Decor', category: 'decor', city: 'riyadh', phone: '0552000003', bio: 'كوش وتنسيق ورد وتصاميم ديكور مخصصة لحفلات الزفاف والخطوبة.' },
  { key: 'hall', business: 'قصر الأميرة للاحتفالات', en: 'Princess Palace Hall', category: 'hall', city: 'riyadh', phone: '0552000004', bio: 'قاعة أفراح فاخرة تتسع لـ 600 ضيف مع مواقف وخدمات متكاملة.' },
  { key: 'beats', business: 'نغم للترفيه والصوتيات', en: 'Nagham Entertainment', category: 'entertainment', city: 'jeddah', phone: '0552000005', bio: 'دي جي ومهندس صوت وفرق ترفيه وزفات عصرية.' },
  { key: 'stage', business: 'سما للإنتاج الفني والحفلات', en: 'Sama Stage Productions', category: 'entertainment', city: 'riyadh', phone: '0552000007', bio: 'حجز الفنانين والفنانات لحفلات الزفاف والمناسبات الخاصة مع الفرقة والصوتيات (بيانات تجريبية).' },
  { key: 'sweet', business: 'حلويات وكيك لمسة سكر', en: 'Sugar Touch', category: 'cake', city: 'jeddah', phone: '0552000006', bio: 'كيك مناسبات وتوزيعات حلويات مصممة حسب الطلب.' },
];

// Prices are in halalas (100 halalas = 1 SAR). VAT 15% is added by the server.
const policy = (o: Record<string, unknown> = {}) => ({ baseAmount: 100000, bookingMode: 'DIRECT', durationMinutes: 240, minDurationMinutes: 60, maxDurationMinutes: 2880, depositBps: 3000, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 7000, beforeHours: 48 }], calendar: { minNoticeHours: 24, bufferMinutes: 30 }, ...o });
type Offer = { id: string; name: string; model: string; policy: ReturnType<typeof policy> };
type Svc = { id: string; title: string; desc: string; images: string[]; sub?: string; artist?: string; offers: Offer[] };
const ARTIST_DESC = 'إحياء حفلة بحضور الفنان مع الفرقة الموسيقية والصوتيات. طلب الحجز يخضع لتوفر الفنان وموافقة المورد (بيانات تجريبية).';
const artist = (n: string, who: string, sub: string, artistId: string, sar: number): Svc => ({ id: 'sample-artist-' + n, title: who, desc: ARTIST_DESC, images: [IMG.stage], sub, artist: artistId,
  offers: [{ id: `sample-artist-${n}-offer`, name: 'حفلة ساعتين', model: 'FIXED', policy: policy({ baseAmount: sar * 100, bookingMode: 'APPROVAL', durationMinutes: 120, minDurationMinutes: 60, depositBps: 5000, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 5000, beforeHours: 72 }] }) }] });
const CATALOG: Record<string, Svc[]> = {
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
  stage: [
    artist('m1', 'حفلة الفنان محمد عبده', 'male-singer', 'artist-m-1', 120000),
    artist('m2', 'حفلة الفنان عبدالمجيد عبدالله', 'male-singer', 'artist-m-2', 100000),
    artist('m3', 'حفلة الفنان ماجد المهندس', 'male-singer', 'artist-m-3', 90000),
    artist('f1', 'حفلة الفنانة أصالة', 'female-singer', 'artist-f-1', 110000),
    artist('f2', 'حفلة الفنانة أحلام', 'female-singer', 'artist-f-2', 95000),
  ],
  beats: [
    artist('m4', 'حفلة الفنان راشد الماجد', 'male-singer', 'artist-m-4', 95000),
    artist('f3', 'حفلة الفنانة أميمة', 'female-singer', 'artist-f-3', 85000),
    { id: 'sample-beats-dj', title: 'دي جي وتجهيز صوتي', desc: 'دي جي محترف مع نظام صوت وإضاءة تناسب الحفلات الخاصة.', images: [IMG.stage], sub: 'event-dj',
      offers: [{ id: 'sample-beats-dj-hour', name: 'دي جي بالساعة', model: 'HOURLY', policy: policy({ baseAmount: 90000, durationMinutes: 240, minDurationMinutes: 180 }) }] },
  ],
  sweet: [
    { id: 'sample-sweet-cake', title: 'كيك مناسبات مصمم حسب الطلب', desc: 'كيك بتصميم خاص ونكهات متعددة مع توصيل وتغليف فاخر.', images: [IMG.balloons],
      offers: [{ id: 'sample-sweet-cake-fixed', name: 'كيك 3 طوابق', model: 'FIXED', policy: policy({ baseAmount: 85000, durationMinutes: 60, minDurationMinutes: 30, calendar: { minNoticeHours: 48, bufferMinutes: 0 } }) }] },
  ],
};
const PACKAGES = [
  { id: 'sample-package-wedding', name: 'باقة الزفاف المتكاملة', desc: 'قاعة وكوشة وتصوير وضيافة بخصم 8% على المجموع.', discountBps: 800, items: ['sample-hall-night', 'sample-bloom-kosha-fixed', 'sample-lens-wedding-full', 'sample-feast-buffet-fixed'] },
  { id: 'sample-package-grad', name: 'باقة التخرج السريعة', desc: 'تصوير وكيك ودي جي لحفلة تخرج مميزة.', discountBps: 500, items: ['sample-lens-grad-fixed', 'sample-sweet-cake-fixed', 'sample-beats-dj-hour'] },
];

// One request seeds one slice (a vendor's next two services) so each stays well inside the function time limit;
// the admin page calls steps in order and the last step approves and builds the packages.
const SLICE = 2;
const STEPS: { vendor: string; services: Svc[] }[] = VENDORS.flatMap(v => { const list = CATALOG[v.key], out: { vendor: string; services: Svc[] }[] = []; for (let i = 0; i < list.length; i += SLICE) out.push({ vendor: v.key, services: list.slice(i, i + SLICE) }); return out; });
export const demoStepCount = STEPS.length + 1;

export async function demoStatus() {
  const [s, o, p, v] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) n FROM "CommerceService" WHERE "id" LIKE 'sample-%'`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) n FROM "CommerceOffer" WHERE "id" LIKE 'sample-%'`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) n FROM "CommercePackage" WHERE "id" LIKE 'sample-%'`,
    prisma.user.count({ where: { email: { endsWith: DOMAIN }, role: 'VENDOR' } }),
  ]);
  return { services: Number(s[0].n), offers: Number(o[0].n), packages: Number(p[0].n), vendors: v, steps: demoStepCount };
}

async function call(origin: string, path: string, method: string, data: unknown, cookie: string) {
  const res = await fetch(origin + path, { method, headers: { 'content-type': 'application/json', cookie, 'x-demo-seed': '1' }, body: data ? JSON.stringify(data) : undefined, cache: 'no-store' });
  let body: any = {}; try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}
const fail = (what: string, r: { status: number; body: any }) => new Error(`${what} (${r.status}): ${r.body?.error || r.body?.message || JSON.stringify(r.body)}`);

/** Runs one step. `adminCookie` is the calling administrator's own cookie header. */
export async function seedDemoStep(step: number, origin: string, adminCookie: string, adminId: string) {
  if (!Number.isInteger(step) || step < 0 || step >= demoStepCount) throw new Error('step out of range');
  if (step === STEPS.length) return finishDemo(origin, adminCookie);
  const { vendor: key, services } = STEPS[step], v = VENDORS.find(x => x.key === key)!, email = key + '.vendor' + DOMAIN;
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (await prisma.user.findFirst({ where: { phone: v.phone } })) throw new Error('رقم الهاتف التجريبي ' + v.phone + ' مستخدم لحساب آخر');
    user = await prisma.user.create({ data: { name: v.business, email, phone: v.phone, role: 'VENDOR', cityId: v.city, isActive: true } });   // no password: cannot sign in
  }
  const existingVendor = await prisma.vendor.findFirst({ where: { userId: user.id } });
  if (existingVendor) { if (existingVendor.status !== 'ACTIVE') await prisma.vendor.update({ where: { id: existingVendor.id }, data: { status: 'ACTIVE' } }); }
  else
    await prisma.vendor.create({ data: { userId: user.id, businessName: v.business, businessNameEn: v.en, categoryId: v.category, cityId: v.city, logo: IMG.party, bannerImage: IMG.wedding, neighborhood: 'وسط المدينة', bioAr: v.bio, cancellationPolicyAr: 'إلغاء مجاني حتى 7 أيام قبل الموعد.', contactPhone: v.phone, whatsappNumber: v.phone, status: 'ACTIVE' } });
  // a short-lived session for this demo vendor, removed again in `finally`
  const token = randomBytes(32).toString('base64url'), tokenHash = digest(token), cookie = 'munasabati_session=' + token;
  await prisma.authSession.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 15 * 60000) } });
  const made = { services: 0, offers: 0 };
  try {
    for (const s of services) {
      const personId = s.artist ? 'sample-person-' + s.id : null;
      if (personId) {
        const name = (await prisma.catalogArtist.findUnique({ where: { id: s.artist! } }))?.nameAr ?? s.artist;
        const r = await call(origin, '/api/bookings/config', 'POST', { kind: 'PERSON', id: personId, body: { nameAr: name, artistId: s.artist, managementAr: v.business, managerIds: [user.id], enabled: true, authorized: true, calendar: { minNoticeHours: 0 } } }, adminCookie);
        if (![200, 409].includes(r.status)) throw fail('performer ' + personId, r);
      }
      const row = (await prisma.$queryRaw<any[]>`SELECT "version", "body" FROM "CommerceService" WHERE "id"=${s.id}`)[0];
      if (!row || (personId && !(row.body.resourceIds || []).includes(personId))) {
        const r = await call(origin, '/api/commerce/manage', 'POST', { kind: 'SERVICE', id: s.id, ...(row ? { version: row.version } : {}), body: { titleAr: s.title, descriptionAr: s.desc, kind: 'BOOKABLE', categoryId: v.category, subcategoryId: s.sub || null, artistId: s.artist || null, cities: [v.city], managerIds: [user.id], resourceIds: personId ? [personId] : [], published: true, approved: false, images: s.images, videoUrls: [] } }, cookie);
        if (r.status !== 200) throw fail('service ' + s.id, r);
        made.services++;
      }
      for (const o of s.offers) {
        const cur = (await prisma.$queryRaw<any[]>`SELECT "version", "body" FROM "CommerceOffer" WHERE "id"=${o.id}`)[0];
        // an offer copies the service's performer profile when it is saved, so it is saved again after the service gained one
        if (cur && !(personId && !(cur.body.resourceIds || []).includes(personId))) continue;
        const r = await call(origin, '/api/commerce/manage', 'POST', { kind: 'OFFER', id: o.id, serviceId: s.id, ...(cur ? { version: cur.version } : {}), body: { nameAr: o.name, model: o.model, enabled: true, allowPackages: true, holdMinutes: 15, policy: o.policy } }, cookie);
        if (r.status !== 200) throw fail('offer ' + o.id, r);
        made.offers++;
      }
    }
  } finally { await prisma.authSession.delete({ where: { tokenHash } }).catch(() => { }); }
  void adminId;
  return { step, ...made };
}

async function finishDemo(origin: string, adminCookie: string) {
  // vendors cannot approve their own services, so the administrator does
  const pending = await prisma.$queryRaw<any[]>`SELECT "id","version","body" FROM "CommerceService" WHERE "id" LIKE 'sample-%' AND COALESCE(("body"->>'approved')::boolean,false)=false`;
  for (const sv of pending) {
    const r = await call(origin, '/api/commerce/manage', 'POST', { kind: 'SERVICE', id: sv.id, version: sv.version, body: { ...sv.body, approved: true } }, adminCookie);
    if (r.status !== 200) throw fail('approving ' + sv.id, r);
  }
  // services and packages hidden by an earlier removal come back
  await prisma.$executeRaw`UPDATE "CommerceService" SET "body"=jsonb_set("body",'{published}','true'), "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id" LIKE 'sample-%' AND COALESCE(("body"->>'published')::boolean,false)=false`;
  await prisma.$executeRaw`UPDATE "CommercePackage" SET "body"=jsonb_set("body",'{published}','true'), "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id" LIKE 'sample-%' AND COALESCE(("body"->>'published')::boolean,false)=false`;
  let packages = 0;
  for (const p of PACKAGES) {
    const have = (await prisma.$queryRaw<any[]>`SELECT "version" FROM "CommercePackage" WHERE "id"=${p.id}`)[0];
    if (have && Number((await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) n FROM "CommercePackageItem" WHERE "packageId"=${p.id}`)[0].n)) continue;
    const r = await call(origin, '/api/commerce/manage', 'POST', { kind: 'PACKAGE', id: p.id, ...(have ? { version: have.version } : {}), body: { nameAr: p.name, descriptionAr: p.desc, published: true, discountBps: p.discountBps, kind: 'CUSTOMIZABLE' }, items: p.items.map((offerId, i) => ({ id: p.id + '-' + i, offerId, quantity: 1, durationMinutes: 240, optional: false, substitutions: [] })) }, adminCookie);
    if (r.status !== 200) throw fail('package ' + p.id, r);
    packages++;
  }
  return { step: STEPS.length, approved: pending.length, packages };
}

async function hideDemoData() {
  await prisma.$executeRaw`UPDATE "CommerceService" SET "body"=jsonb_set("body",'{published}','false'), "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id" LIKE 'sample-%'`;
  await prisma.$executeRaw`UPDATE "CommercePackage" SET "body"=jsonb_set("body",'{published}','false'), "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id" LIKE 'sample-%'`;
  await prisma.vendor.updateMany({ where: { user: { email: { endsWith: DOMAIN }, role: 'VENDOR' } }, data: { status: 'SUSPENDED' } });
}

/**
 * Removes every demo record. The database refuses to delete what history depends on (orders, price quotes, frozen package
 * pricing), so when a full delete is not possible the demo services and packages are unpublished instead and `kept` is
 * true; adding demo data again brings them back.
 */
export async function removeDemoData() {
  await hideDemoData();   // first make sure nothing demo is visible, whatever happens next
  const ordered = Number((await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) n FROM "CommerceOrderItem" WHERE "offerId" LIKE 'sample-%' OR "serviceId" LIKE 'sample-%'`)[0].n);
  if (ordered) return { kept: true, orders: ordered };
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`DELETE FROM "CommercePackageItem" WHERE "packageId" LIKE 'sample-%' OR "offerId" LIKE 'sample-%'`;
      await tx.$executeRaw`DELETE FROM "CommerceOfferVersion" WHERE "offerId" LIKE 'sample-%'`;
      await tx.$executeRaw`DELETE FROM "CommerceOffer" WHERE "id" LIKE 'sample-%' OR "serviceId" LIKE 'sample-%'`;
      await tx.$executeRaw`DELETE FROM "CommerceRelationship" WHERE "serviceId" LIKE 'sample-%' OR "relatedServiceId" LIKE 'sample-%'`;
      await tx.$executeRaw`DELETE FROM "CommerceService" WHERE "id" LIKE 'sample-%'`;
      await tx.$executeRaw`DELETE FROM "ServiceDefinition" WHERE "id" LIKE 'sample-%'`;
      const ids = (await tx.user.findMany({ where: { email: { endsWith: DOMAIN }, role: 'VENDOR' }, select: { id: true } })).map(u => u.id);
      if (ids.length) {
        await tx.systemAuditLog.deleteMany({ where: { actorId: { in: ids } } });
        await tx.vendor.deleteMany({ where: { userId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      }
    }, { timeout: 30000 });
  } catch { return { kept: true, orders: 0 }; }
  // a package's frozen pricing history cannot be deleted, so a package that has any stays as an unpublished record
  let packagesKept = 0;
  for (const p of await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CommercePackage" WHERE "id" LIKE 'sample-%'`) {
    try {
      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM "CommercePackageVersion" WHERE "packageId"=${p.id}`,
        prisma.$executeRaw`DELETE FROM "CommercePackage" WHERE "id"=${p.id}`,
      ]);
    } catch { packagesKept++; }
  }
  return { kept: false, orders: 0, packagesKept };
}
