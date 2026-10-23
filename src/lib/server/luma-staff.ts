import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireAdmin, rateLimit } from './auth';
import { HttpError, text } from './http';
import { categoryNoun, matchCategory, matchCity } from '@/lib/luma/vocabulary';
import { vendorInsights } from './vendor-insights';
import { counts, Reminder, remindersFor } from './commerce-v2/reminders';

export type Intent = 'VENDORS_TOP' | 'REMINDERS_ALL' | 'REMINDERS_DUE' | 'REMINDERS_OVERDUE' | 'REMINDERS_PROBLEMS' | 'AWAITING_ACTION' | 'COVERAGE_GAPS' | 'VENDORS_PENDING' | 'UNKNOWN';
export interface Params { categoryId?: string; cityId?: string }
export interface Suggestion { label: string; intent: Intent; params: Params; learned?: boolean }

const INTENTS: Intent[] = ['VENDORS_TOP', 'REMINDERS_ALL', 'REMINDERS_DUE', 'REMINDERS_OVERDUE', 'REMINDERS_PROBLEMS', 'AWAITING_ACTION', 'COVERAGE_GAPS', 'VENDORS_PENDING'];
const named = (rows: any[]) => rows.map(r => ({ id: r.id as string, nameAr: r.nameAr as string, nameEn: r.nameEn as string | null }));
async function vocabulary() {
  const [categories, cities] = await Promise.all([prisma.serviceCategory.findMany({ select: { id: true, nameAr: true, nameEn: true } }), prisma.saudiCity.findMany({ select: { id: true, nameAr: true, nameEn: true } })]);
  return { categories: named(categories), cities: named(cities) };
}

/** Reads a question in words; anything that is not one of the things the assistant can answer exactly is UNKNOWN (never guessed at). */
export function parse(question: string, vocab: { categories: any[]; cities: any[] }): { intent: Intent; params: Params } {
  const q = question.replace(/[؟?]/g, ' ');
  const category = matchCategory(q, vocab.categories), city = matchCity(q, vocab.cities);
  const params: Params = { ...(category ? { categoryId: category.id } : {}), ...(city ? { cityId: city.id } : {}) };
  const has = (re: RegExp) => re.test(q);
  if (has(/متأخر|تأخر|فات موعد|لم يبدأ/)) return { intent: 'REMINDERS_OVERDUE', params: {} };
  if (has(/مشكل|مشاكل|نزاع|إلغاء|الغاء|إعادة جدولة|ملاحظات/)) return { intent: 'REMINDERS_PROBLEMS', params: {} };
  if (has(/مستحق|موعد|قريب|اليوم|غد|48|الأيام القادمة/) && has(/خدمة|خدمات|حجز|حجوزات|مستحق|موعد/)) return { intent: 'REMINDERS_DUE', params: {} };
  if (has(/تنبيه|تنبيهات|تذكير|تذكيرات|عاجل|ماذا لدي|ما المطلوب/)) return { intent: 'REMINDERS_ALL', params: {} };
  if (has(/بانتظار|معلق|موافقة|[يت]نتظر|إجراء|اجراء/) && !has(/مورد.*اعتماد/)) return { intent: 'AWAITING_ACTION', params: {} };
  if (has(/اعتماد.*مورد|مورد.*اعتماد|موردين جدد|تحت المراجعة/)) return { intent: 'VENDORS_PENDING', params: {} };
  if (has(/تغطية|فجوة|فجوات|ينقصنا|نقص|لا يوجد مورد|بدون مورد/) && category) return { intent: 'COVERAGE_GAPS', params: { categoryId: category.id } };
  if (category || city || has(/مورد|موردين|أفضل|افضل|تقييم|متميز|مميز/)) return { intent: 'VENDORS_TOP', params };
  return { intent: 'UNKNOWN', params: {} };
}

const cardOf = (r: Reminder) => ({ id: r.id, severity: r.severity, titleAr: r.titleAr, detailAr: r.detailAr, url: r.url, dueAt: r.dueAt });

/** Questions the assistant answers exactly, built from what the application really holds, with the ones people actually asked successfully first. */
export async function suggestions(vocab?: { categories: any[]; cities: any[] }): Promise<Suggestion[]> {
  const v = vocab ?? await vocabulary();
  const learned = await prisma.$queryRaw<any[]>`SELECT "intent","categoryId","cityId", COUNT(*)::int AS n FROM "LumaQuestionLog" WHERE "audience"='staff' AND "resultCount">0 AND "intent" <> 'UNKNOWN' AND "createdAt" > CURRENT_TIMESTAMP - interval '30 days' GROUP BY 1,2,3 ORDER BY n DESC, MAX("createdAt") DESC LIMIT 12`;
  const pairs = await prisma.$queryRaw<any[]>`SELECT "categoryId","cityId", COUNT(*)::int AS n FROM "Vendor" WHERE "status"='ACTIVE' GROUP BY 1,2 ORDER BY n DESC, 1, 2 LIMIT 6`;
  const gaps = await prisma.$queryRaw<any[]>`SELECT c."id", COUNT(DISTINCT v."cityId")::int AS n FROM "ServiceCategory" c JOIN "Vendor" v ON v."categoryId"=c."id" AND v."status"='ACTIVE' GROUP BY c."id" ORDER BY n, c."id" LIMIT 1`;
  const cat = (id?: string) => v.categories.find(c => c.id === id), city = (id?: string) => v.cities.find(c => c.id === id);
  const label = (intent: Intent, p: Params): string | null => {
    switch (intent) {
      case 'VENDORS_TOP': return p.categoryId && cat(p.categoryId) ? `أفضل ${categoryNoun(cat(p.categoryId))}${p.cityId && city(p.cityId) ? ' في ' + city(p.cityId).nameAr : ''}` : 'من أفضل الموردين تقييماً؟';
      case 'REMINDERS_ALL': return 'ما التنبيهات العاجلة اليوم؟';
      case 'REMINDERS_DUE': return 'ما الخدمات المستحقة خلال 48 ساعة؟';
      case 'REMINDERS_OVERDUE': return 'ما الخدمات المتأخرة؟';
      case 'REMINDERS_PROBLEMS': return 'هل توجد مشكلات أو ملاحظات مفتوحة؟';
      case 'AWAITING_ACTION': return 'ما الطلبات التي تنتظر إجراءً؟';
      case 'COVERAGE_GAPS': return p.categoryId && cat(p.categoryId) ? `أين ينقصنا موردون في ${cat(p.categoryId).nameAr}؟` : null;
      case 'VENDORS_PENDING': return 'من الموردون بانتظار الاعتماد؟';
      default: return null;
    }
  };
  const out: Suggestion[] = [], seen = new Set<string>();
  const push = (intent: Intent, params: Params, isLearned = false) => { const l = label(intent, params); if (!l || seen.has(l)) return; seen.add(l); out.push({ label: l, intent, params, ...(isLearned ? { learned: true } : {}) }); };
  for (const r of learned.slice(0, 4)) push(r.intent, { ...(r.categoryId ? { categoryId: r.categoryId } : {}), ...(r.cityId ? { cityId: r.cityId } : {}) }, true);
  push('REMINDERS_ALL', {}); push('REMINDERS_DUE', {}); push('REMINDERS_PROBLEMS', {});
  for (const r of pairs.slice(0, 3)) push('VENDORS_TOP', { categoryId: r.categoryId, cityId: r.cityId });
  if (gaps[0]) push('COVERAGE_GAPS', { categoryId: gaps[0].id });
  push('REMINDERS_OVERDUE', {}); push('AWAITING_ACTION', {});
  return out.slice(0, 8);
}

async function log(userId: string, intent: Intent, p: Params, resultCount: number, freeText?: string) {
  const clean = freeText ? freeText.replace(/\d{7,}/g, '…').slice(0, 160) : null;      // numbers that could be phone numbers never reach the log
  await prisma.$executeRaw`INSERT INTO "LumaQuestionLog" ("id","audience","intent","categoryId","cityId","resultCount","text","userId") VALUES (${randomUUID()},'staff',${intent},${p.categoryId ?? null},${p.cityId ?? null},${resultCount},${intent === 'UNKNOWN' ? clean : null},${userId})`;
}

export async function staffAsk(input: any) {
  const user = await requireAdmin();
  await rateLimit('luma-staff:' + user.id, 120, 60000);
  const vocab = await vocabulary();
  let intent: Intent, params: Params;
  if (input.intent !== undefined) {
    if (!INTENTS.includes(input.intent)) throw new HttpError(400, 'بيانات غير صالحة');
    intent = input.intent;
    params = { ...(input.params?.categoryId ? { categoryId: text(input.params.categoryId, 100) } : {}), ...(input.params?.cityId ? { cityId: text(input.params.cityId, 100) } : {}) };
  } else ({ intent, params } = parse(text(input.text, 300, true), vocab));

  let result: { answerAr: string; vendors?: any[]; items?: any[]; rows?: { label: string; value: string }[]; count: number };
  const reminders = (kinds: string[] | null, emptyAr: string, titleAr: string, filter?: (r: Reminder) => boolean) => remindersFor(user).then(all => {
    const list = all.filter(r => (!kinds || kinds.includes(r.kind)) && (!filter || filter(r)));
    const c = counts(list);
    return { answerAr: list.length ? `${titleAr}: **${list.length}** (${c.critical} عاجل، ${c.warning} تحذير، ${c.info} للعلم).` : emptyAr, items: list.slice(0, 12).map(cardOf), count: list.length };
  });
  switch (intent) {
    case 'VENDORS_TOP': {
      const q = new URLSearchParams(); if (params.categoryId) q.set('categoryId', params.categoryId); if (params.cityId) q.set('cityId', params.cityId); q.set('limit', '8');
      const r = await vendorInsights(q), where = [r.categoryAr, r.cityAr].filter(Boolean).join(' — ') || 'كل الخدمات والمناطق';
      result = { answerAr: r.vendors.length ? `هؤلاء أبرز الموردين (${where}): **${r.vendors.length}** من أصل ${r.total}.\nالترتيب بحسب ${r.method}.` : `لا يوجد موردون نشطون يطابقون (${where}) حالياً.`, vendors: r.vendors, count: r.vendors.length };
      break;
    }
    case 'REMINDERS_ALL': result = await reminders(null, 'لا توجد تنبيهات الآن. كل شيء تحت السيطرة.', 'التنبيهات الحالية'); break;
    case 'REMINDERS_DUE': result = await reminders(['DUE_SOON', 'EXPIRING_SOON', 'HOLD_EXPIRING'], 'لا توجد خدمات مستحقة خلال 48 ساعة.', 'خدمات ومواعيد مستحقة قريباً'); break;
    case 'REMINDERS_OVERDUE': result = await reminders(['OVERDUE_START', 'OVERDUE_COMPLETION'], 'لا توجد خدمات متأخرة.', 'خدمات متأخرة'); break;
    case 'REMINDERS_PROBLEMS': result = await reminders(['PROBLEM', 'CUSTOMER_NOTE', 'FAILED_NOTIFICATIONS', 'FINANCE_REVIEW'], 'لا توجد مشكلات أو ملاحظات مفتوحة.', 'مشكلات وملاحظات تحتاج متابعة'); break;
    case 'AWAITING_ACTION': result = await reminders(['AWAITING_ACTION', 'EXPIRING_SOON'], 'لا توجد طلبات تنتظر إجراءً.', 'طلبات تنتظر إجراءً'); break;
    case 'VENDORS_PENDING': {
      const rows = await prisma.$queryRaw<any[]>`SELECT v."businessName", c."nameAr" AS "category", ci."nameAr" AS "city" FROM "Vendor" v JOIN "ServiceCategory" c ON c."id"=v."categoryId" JOIN "SaudiCity" ci ON ci."id"=v."cityId" WHERE v."status"='UNDER_REVIEW' ORDER BY v."createdAt" LIMIT 20`;
      result = { answerAr: rows.length ? `موردون بانتظار الاعتماد: **${rows.length}**.` : 'لا يوجد موردون بانتظار الاعتماد.', rows: rows.map(r => ({ label: r.businessName, value: `${r.category} — ${r.city}` })), count: rows.length };
      break;
    }
    case 'COVERAGE_GAPS': {
      const category = vocab.categories.find(c => c.id === params.categoryId);
      if (!category) { result = { answerAr: 'حدد الخدمة التي تريد فحص تغطيتها (مثال: أين ينقصنا موردون في التصوير؟).', count: 0 }; break; }
      const covered = await prisma.$queryRaw<any[]>`SELECT DISTINCT "cityId" FROM "Vendor" WHERE "status"='ACTIVE' AND "categoryId"=${category.id} UNION SELECT DISTINCT unnest("serviceAreas") FROM "Vendor" WHERE "status"='ACTIVE' AND "categoryId"=${category.id}`;
      const have = new Set(covered.map(r => r.cityId ?? r.unnest));
      const enabled = await prisma.saudiCity.findMany({ where: { isAvailable: true }, select: { id: true, nameAr: true }, orderBy: { nameAr: 'asc' } });
      const missing = enabled.filter(c => !have.has(c.id));
      result = { answerAr: missing.length ? `مدن بلا مورد نشط في ${category.nameAr}: **${missing.length}** من ${enabled.length}.` : `كل المدن المفعلة (${enabled.length}) لديها مورد نشط واحد على الأقل في ${category.nameAr}.`, rows: missing.map(c => ({ label: c.nameAr, value: 'لا يوجد مورد نشط' })), count: missing.length };
      break;
    }
    default: {
      const next = await suggestions(vocab);
      await log(user.id, 'UNKNOWN', {}, 0, input.text);
      return { intent, params, answerAr: 'لا أستطيع الإجابة عن هذا السؤال بدقة، ولا أحب أن أخمّن. هذه أسئلة أجيب عنها بدقة من بيانات المنصة:', unknown: true, suggestions: next };
    }
  }
  await log(user.id, intent, params, result.count);
  return { intent, params, ...result, suggestions: await suggestions(vocab) };
}

export async function staffSuggestions() { await requireAdmin(); return { suggestions: await suggestions() }; }

/** For administrators: what was asked most, and what the assistant could not answer. */
export async function lumaInsights() {
  await requireAdmin();
  const top = await prisma.$queryRaw<any[]>`SELECT "audience","intent","categoryId","cityId", COUNT(*)::int AS asked, COUNT(*) FILTER (WHERE "resultCount">0)::int AS answered FROM "LumaQuestionLog" WHERE "createdAt" > CURRENT_TIMESTAMP - interval '30 days' GROUP BY 1,2,3,4 ORDER BY asked DESC LIMIT 20`;
  const unanswered = await prisma.$queryRaw<any[]>`SELECT "text", COUNT(*)::int AS n, MAX("createdAt") AS "last" FROM "LumaQuestionLog" WHERE "intent"='UNKNOWN' AND "text" IS NOT NULL AND "createdAt" > CURRENT_TIMESTAMP - interval '30 days' GROUP BY "text" ORDER BY n DESC, "last" DESC LIMIT 20`;
  const noResults = await prisma.$queryRaw<any[]>`SELECT "audience","categoryId","cityId", COUNT(*)::int AS n FROM "LumaQuestionLog" WHERE "resultCount"=0 AND "intent" NOT IN ('UNKNOWN') AND "createdAt" > CURRENT_TIMESTAMP - interval '30 days' GROUP BY 1,2,3 ORDER BY n DESC LIMIT 20`;
  return { top, unanswered, noResults };
}

/** Customers: only structured facts are recorded (no free text), to learn which searches succeed. */
export async function logCustomerQuestion(ip: string, input: any) {
  await rateLimit('luma-log:' + ip, 120, 60000);
  const intent = text(input.intent, 40, true).toUpperCase();
  if (!/^[A-Z_]{3,40}$/.test(intent)) throw new HttpError(400, 'بيانات غير صالحة');
  const count = Number.isInteger(input.resultCount) && input.resultCount >= 0 ? Math.min(input.resultCount, 10000) : 0;
  await prisma.$executeRaw`INSERT INTO "LumaQuestionLog" ("id","audience","intent","categoryId","cityId","resultCount") VALUES (${randomUUID()},'customer',${intent},${input.categoryId ? text(input.categoryId, 100) : null},${input.cityId ? text(input.cityId, 100) : null},${count})`;
  return { ok: true };
}
/** Which searches customers make successfully, most popular first (the customer assistant keeps only those it can answer right now). */
export async function customerPopularity() {
  return prisma.$queryRaw<any[]>`SELECT "categoryId","cityId", COUNT(*)::int AS n FROM "LumaQuestionLog" WHERE "audience"='customer' AND "resultCount">0 AND "categoryId" IS NOT NULL AND "createdAt" > CURRENT_TIMESTAMP - interval '30 days' GROUP BY 1,2 ORDER BY n DESC LIMIT 20`;
}
