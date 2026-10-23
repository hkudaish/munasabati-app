import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { digest, sessionUser } from '../auth';
import { HttpError, text, integer } from '../http';
import { atomic, lock, Tx } from '../booking/repository';
import { activeLines, cartBody, parseLines, publicQuote, quoteLines, quoteOptionsFor } from './cart';
import { emit } from './events';
import { recordBaseline } from './price-watch';

const GUEST_COOKIE = 'bd_guest';
const MAX_ACTIVE_DRAFTS = 50;
const stable = (value: any): any => (Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value);
const hashOf = (data: unknown) => createHash('sha256').update(JSON.stringify(stable(data))).digest('hex');

/** Which parts of a booking depend on which choice. Changing a choice re-checks exactly its dependents and leaves everything else alone. */
const DEPENDENTS: Record<string, string[]> = {
  offerId: ['options', 'price', 'availability', 'vendorSelection'], packageId: ['choices', 'price', 'availability', 'vendorSelection'],
  cityId: ['availability', 'price', 'vendorSelection'], date: ['availability', 'price'], time: ['availability', 'price'],
  quantity: ['price', 'availability'], durationMinutes: ['price', 'availability'], guestCount: ['price', 'availability'],
  options: ['price'], choices: ['price'], fields: [], notes: [], venue: [],
};
/** Choices that only make sense for the previous offer/package and are therefore cleared when it changes (everything else is kept). */
const BOUND_TO: Record<string, string[]> = { offerId: ['options'], packageId: ['choices'] };
const CONFIG_KEYS = Object.keys(DEPENDENTS);
const STEPS: Record<string, string[]> = {
  BOOKABLE: ['service', 'offer', 'location', 'datetime', 'customize', 'review'], FIELD: ['service', 'offer', 'location', 'datetime', 'customize', 'review'],
  PHYSICAL: ['service', 'offer', 'location', 'customize', 'review'], DIGITAL: ['service', 'offer', 'customize', 'review'],
};
export const stepsFor = (kind: string) => STEPS[kind] ?? STEPS.BOOKABLE;

function normalize(changes: any): Record<string, unknown> {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new HttpError(400, 'بيانات غير صالحة');
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (key === 'currentStep') continue;
    if (!CONFIG_KEYS.includes(key)) throw new HttpError(400, 'حقول غير صالحة');
    if (value === null || value === '') { out[key] = null; continue; }
    if (['offerId', 'packageId', 'cityId'].includes(key)) out[key] = text(value, 140, true);
    else if (key === 'date') out[key] = text(value, 10, true);
    else if (key === 'time') out[key] = text(value, 5, true);
    else if (key === 'notes') out[key] = text(value, 2000);
    else if (key === 'venue') out[key] = text(value, 1000);
    else if (['quantity', 'guestCount'].includes(key)) out[key] = Math.max(1, integer(value, 100000, 1));
    else if (key === 'durationMinutes') out[key] = integer(value, 525600, 0) || null;
    else { if (typeof value !== 'object' || JSON.stringify(value).length > 20000) throw new HttpError(400, 'حقول غير صالحة'); out[key] = value; }
  }
  return out;
}

interface Actor { userId: string | null; guestHash: string | null }
/** The signed-in customer, or the anonymous visitor identified by an httpOnly token. A guest's drafts move to their account the moment they sign in. */
async function identify(create = false): Promise<Actor> {
  const user = await sessionUser();
  const token = cookies().get(GUEST_COOKIE)?.value;
  if (user) {
    if (token) {
      await prisma.$executeRaw`UPDATE "BookingDraft" SET "userId"=${user.id},"guestTokenHash"=NULL,"expiresAt"=CURRENT_TIMESTAMP + interval '90 days',"updatedAt"=CURRENT_TIMESTAMP WHERE "guestTokenHash"=${digest(token)} AND "userId" IS NULL`;
      cookies().delete(GUEST_COOKIE);
    }
    return { userId: user.id, guestHash: null };
  }
  if (token) return { userId: null, guestHash: digest(token) };
  if (!create) throw new HttpError(401, 'يرجى تسجيل الدخول');
  const fresh = randomBytes(32).toString('base64url');
  cookies().set(GUEST_COOKIE, fresh, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 86400 });
  return { userId: null, guestHash: digest(fresh) };
}
const owns = (draft: any, actor: Actor) => (actor.userId ? draft.userId === actor.userId : !!actor.guestHash && draft.guestTokenHash === actor.guestHash);
async function loadDraft(tx: Tx, id: string, actor: Actor, locked = false) {
  if (locked) await lock(tx, 'draft:' + id);
  const draft = (await tx.$queryRaw<any[]>`SELECT * FROM "BookingDraft" WHERE "id"=${text(id, 140, true)}`)[0];
  if (!draft || !owns(draft, actor)) throw new HttpError(404, 'الطلب غير موجود');       // never reveal that someone else's draft exists
  return draft;
}
const snapshotOf = async (tx: Tx, draft: any) => (draft.latestSnapshotId ? (await tx.$queryRaw<any[]>`SELECT * FROM "BookingSnapshot" WHERE "id"=${draft.latestSnapshotId}`)[0] : null);

export type ValidationStatus = 'VALID' | 'NEEDS_REVALIDATION' | 'INCOMPATIBLE' | 'UNAVAILABLE';
/** Checks a configuration against the real rules (coverage, availability, capacity, price) without saving anything. */
async function validateConfig(tx: Tx, serviceId: string, kind: string, config: any): Promise<{ status: ValidationStatus; issues: { code: string; message: string }[]; quote?: any }> {
  const missing: string[] = [];
  if (!config.offerId && !config.packageId) missing.push('offerId');
  if (!config.cityId) missing.push('cityId');
  if (['BOOKABLE', 'FIELD'].includes(kind)) { if (!config.date) missing.push('date'); if (!config.time) missing.push('time'); }
  if (missing.length) return { status: 'NEEDS_REVALIDATION', issues: missing.map(field => ({ code: 'MISSING_' + field.toUpperCase(), message: field })) };
  if (config.offerId) {
    const offer = (await tx.$queryRaw<any[]>`SELECT "serviceId" FROM "CommerceOffer" WHERE "id"=${config.offerId}`)[0];
    if (!offer || offer.serviceId !== serviceId) return { status: 'INCOMPATIBLE', issues: [{ code: 'OFFER_NOT_IN_SERVICE', message: 'العرض تغير أو يتبع خدمة أخرى' }] };
  }
  try {
    const [line] = parseLines([{ id: 'draft', ...config }]);
    return { status: 'VALID', issues: [], quote: publicQuote(await quoteLines(tx, [line])) };
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    return { status: error.status === 409 ? 'UNAVAILABLE' : 'INCOMPATIBLE', issues: [{ code: error.status === 409 ? 'UNAVAILABLE' : 'INCOMPATIBLE', message: error.message }] };
  }
}
const serviceKind = async (tx: Tx, serviceId: string) => {
  const row = (await tx.$queryRaw<any[]>`SELECT "body" FROM "CommerceService" WHERE "id"=${serviceId}`)[0];
  if (!row) throw new HttpError(404, 'الخدمة غير موجودة');
  return { kind: row.body.kind as string, published: row.body.published === true && row.body.approved === true, ownerId: row.ownerId as string | undefined };
};
const view = (draft: any, snapshot: any, kind: string, validation?: any) => ({
  id: draft.id, serviceId: draft.serviceId, status: draft.status, currentStep: draft.currentStep, steps: stepsFor(kind), version: draft.version, config: snapshot?.data?.config ?? {},
  cartLineId: draft.cartLineId, lastActivityAt: draft.lastActivityAt, updatedAt: draft.updatedAt, ...(validation ? { validationStatus: validation.status, issues: validation.issues, quote: validation.quote } : {}),
});

/** Starts a draft for a service, or resumes the customer's unfinished one for the same service (so "continue booking" finds it). */
export async function createDraft(input: any) {
  const actor = await identify(true), serviceId = text(input.serviceId, 140, true), config = normalize(input.config ?? {});
  return atomic(async tx => {
    const { kind, published } = await serviceKind(tx, serviceId);
    if (!published) throw new HttpError(404, 'الخدمة غير موجودة');
    const owner = actor.userId ?? actor.guestHash;
    await lock(tx, 'drafts:' + owner);
    if (input.reuse !== false) {
      const existing = (await tx.$queryRaw<any[]>`SELECT * FROM "BookingDraft" WHERE "serviceId"=${serviceId} AND "status"='IN_PROGRESS' AND COALESCE("userId",'')=${actor.userId ?? ''} AND COALESCE("guestTokenHash",'')=${actor.guestHash ?? ''} ORDER BY "updatedAt" DESC LIMIT 1`)[0];
      if (existing) return { ...view(existing, await snapshotOf(tx, existing), kind), resumed: true };
    }
    const count = (await tx.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "BookingDraft" WHERE "status" IN ('IN_PROGRESS','IN_CART') AND COALESCE("userId",'')=${actor.userId ?? ''} AND COALESCE("guestTokenHash",'')=${actor.guestHash ?? ''}`)[0].n;
    if (count >= MAX_ACTIVE_DRAFTS) throw new HttpError(400, 'الحد الأقصى 100 عنصر تنفيذ في الطلب');
    const id = randomUUID(), snapshotId = randomUUID(), data = { config: Object.fromEntries(Object.entries(config).filter(([, v]) => v !== null)) };
    const days = actor.userId ? 90 : 30;
    await tx.$executeRaw`INSERT INTO "BookingDraft" ("id","userId","guestTokenHash","serviceId","version","expiresAt") VALUES (${id},${actor.userId},${actor.guestHash},${serviceId},1,CURRENT_TIMESTAMP + ${days + ' days'}::interval)`;
    await tx.$executeRaw`INSERT INTO "BookingSnapshot" ("id","draftId","versionNumber","data","hash","changedFields","createdBy") VALUES (${snapshotId},${id},1,${JSON.stringify(data)}::jsonb,${hashOf(data)},${JSON.stringify(Object.keys(data.config))}::jsonb,${actor.userId})`;
    await tx.$executeRaw`UPDATE "BookingDraft" SET "latestSnapshotId"=${snapshotId} WHERE "id"=${id}`;
    await emit(tx, { aggregateType: 'BookingDraft', aggregateId: id, version: 1, type: 'BookingDraftCreated', payload: { serviceId } });
    const draft = (await tx.$queryRaw<any[]>`SELECT * FROM "BookingDraft" WHERE "id"=${id}`)[0];
    return { ...view(draft, await snapshotOf(tx, draft), kind, await validateConfig(tx, serviceId, kind, data.config)), resumed: false };
  });
}

export async function getDraft(id: string) {
  const actor = await identify();
  return atomic(async tx => {
    const draft = await loadDraft(tx, id, actor), { kind } = await serviceKind(tx, draft.serviceId), snapshot = await snapshotOf(tx, draft);
    return view(draft, snapshot, kind, await validateConfig(tx, draft.serviceId, kind, snapshot?.data?.config ?? {}));
  });
}

export async function listDrafts() {
  const actor = await identify();
  const rows = await prisma.$queryRaw<any[]>`SELECT d."id",d."serviceId",d."status",d."currentStep",d."version",d."lastActivityAt",d."cartLineId",s."body"->>'titleAr' AS "titleAr",s."body"->>'titleEn' AS "titleEn",snap."data" AS "data" FROM "BookingDraft" d LEFT JOIN "CommerceService" s ON s."id"=d."serviceId" LEFT JOIN "BookingSnapshot" snap ON snap."id"=d."latestSnapshotId" WHERE d."status" IN ('IN_PROGRESS','IN_CART') AND COALESCE(d."userId",'')=${actor.userId ?? ''} AND COALESCE(d."guestTokenHash",'')=${actor.guestHash ?? ''} ORDER BY d."lastActivityAt" DESC LIMIT 100`;
  return { drafts: rows.map(r => ({ id: r.id, serviceId: r.serviceId, titleAr: r.titleAr, titleEn: r.titleEn, status: r.status, currentStep: r.currentStep, version: r.version, lastActivityAt: r.lastActivityAt, cartLineId: r.cartLineId, config: r.data?.config ?? {} })) };
}

/**
 * Saves a change as a new immutable version. The caller names the version it was looking at; if someone (another tab, another device)
 * saved in the meantime, nothing is overwritten and the newer state is returned so the customer can decide.
 */
export async function saveDraft(id: string, input: any) {
  const actor = await identify(), expected = input.expectedVersion;
  if (!Number.isInteger(expected)) throw new HttpError(400, 'بيانات غير صالحة');
  const changes = normalize(input.changes ?? {}), step = input.changes?.currentStep ? text(input.changes.currentStep, 40, true) : null;
  return atomic(async tx => {
    const draft = await loadDraft(tx, id, actor, true);
    const { kind } = await serviceKind(tx, draft.serviceId), previous = await snapshotOf(tx, draft);
    if (draft.status !== 'IN_PROGRESS' && draft.status !== 'IN_CART') throw new HttpError(409, 'تغير الطلب');
    if (draft.version !== expected) throw new HttpError(409, 'تغير الطلب', { conflict: true, currentVersion: draft.version, current: view(draft, previous, kind) });
    const before = previous?.data?.config ?? {}, config: Record<string, any> = { ...before }, changed: string[] = [], cleared: string[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (hashOf(before[key] ?? null) === hashOf(value)) continue;
      changed.push(key);
      if (value === null) delete config[key]; else config[key] = value;
      for (const bound of BOUND_TO[key] ?? []) if (config[bound] !== undefined && !(bound in changes)) { delete config[bound]; cleared.push(bound); }
    }
    const affected = Array.from(new Set(changed.flatMap(k => DEPENDENTS[k] ?? [])));
    const data = { config }, hash = hashOf(data);
    if (!changed.length && (!step || step === draft.currentStep)) {
      return { draftId: id, version: draft.version, saved: true, unchanged: true, validationStatus: (await validateConfig(tx, draft.serviceId, kind, config)).status, affectedFields: [], clearedFields: [], requiresCustomerReview: false, cartUpdated: false };
    }
    let version = draft.version, latest = draft.latestSnapshotId;
    if (changed.length) {
      version = draft.version + 1; latest = randomUUID();
      await tx.$executeRaw`INSERT INTO "BookingSnapshot" ("id","draftId","versionNumber","data","hash","changedFields","previousSnapshotId","createdBy") VALUES (${latest},${id},${version},${JSON.stringify(data)}::jsonb,${hash},${JSON.stringify(changed)}::jsonb,${draft.latestSnapshotId},${actor.userId})`;
    }
    await tx.$executeRaw`UPDATE "BookingDraft" SET "version"=${version},"latestSnapshotId"=${latest},"currentStep"=${step ?? draft.currentStep},"lastActivityAt"=CURRENT_TIMESTAMP,"expiresAt"=CURRENT_TIMESTAMP + ${(actor.userId ? 90 : 30) + ' days'}::interval,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`;
    const validation = await validateConfig(tx, draft.serviceId, kind, config);
    // a draft that is already in the cart carries its edit into the cart item, but only when the result can really be bought
    let cartUpdated = false;
    if (draft.status === 'IN_CART' && draft.userId && changed.length && validation.status === 'VALID') cartUpdated = await updateCartLine(tx, draft, config, latest as string);
    await emit(tx, { aggregateType: 'BookingDraft', aggregateId: id, version, type: 'BookingDraftSaved', payload: { changed, affected, cartUpdated } });
    return { draftId: id, version, saved: true, validationStatus: validation.status, issues: validation.issues, quote: validation.quote, affectedFields: affected, changedFields: changed, clearedFields: cleared, requiresCustomerReview: validation.status !== 'VALID' || cleared.length > 0, cartUpdated };
  });
}

export async function validateDraft(id: string) { return getDraft(id).then(d => ({ draftId: d.id, version: d.version, validationStatus: d.validationStatus, issues: d.issues, quote: d.quote })); }

export async function draftHistory(id: string) {
  const actor = await identify();
  return atomic(async tx => {
    const draft = await loadDraft(tx, id, actor);
    const rows = await tx.$queryRaw<any[]>`SELECT "versionNumber","changedFields","hash","createdAt" FROM "BookingSnapshot" WHERE "draftId"=${draft.id} ORDER BY "versionNumber" DESC LIMIT 200`;
    return { draftId: draft.id, currentVersion: draft.version, versions: rows };
  });
}

/** Restoring writes the old state as a NEW version; history is never rewritten. */
export async function restoreDraft(id: string, input: any) {
  const actor = await identify(), versionNumber = input.versionNumber;
  if (!Number.isInteger(versionNumber)) throw new HttpError(400, 'بيانات غير صالحة');
  const old = await atomic(async tx => {
    const draft = await loadDraft(tx, id, actor);
    const row = (await tx.$queryRaw<any[]>`SELECT "data" FROM "BookingSnapshot" WHERE "draftId"=${draft.id} AND "versionNumber"=${versionNumber}`)[0];
    if (!row) throw new HttpError(404, 'الطلب غير موجود');
    return { config: row.data.config as Record<string, any>, current: (await snapshotOf(tx, draft))?.data?.config ?? {} };
  });
  const changes: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS) if (hashOf(old.config[key] ?? null) !== hashOf(old.current[key] ?? null)) changes[key] = old.config[key] ?? null;
  return saveDraft(id, { expectedVersion: input.expectedVersion, changes });
}

async function updateCartLine(tx: Tx, draft: any, config: any, snapshotId: string) {
  await lock(tx, 'cart:' + draft.userId);
  const cart = (await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${draft.userId}`)[0];
  const current = cart?.body.lines.find((l: any) => l.id === draft.cartLineId);
  if (!current) return false;
  const [line] = parseLines([{ id: draft.cartLineId, ...config, draftId: draft.id, snapshotId, ...(current.savedForLater ? { savedForLater: true } : {}) }]);
  const lines = cart.body.lines.map((l: any) => (l.id === draft.cartLineId ? line : l));
  const quote = await quoteLines(tx, activeLines(lines), quoteOptionsFor(draft.userId, cart.body));
  await tx.$executeRaw`UPDATE "CommerceCart" SET "body"=${JSON.stringify(cartBody(cart.body, lines))}::jsonb,"version"="version"+1,"lastActivityAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${draft.userId}`;
  await recordBaseline(tx, draft.userId, quote.lines);
  await emit(tx, { aggregateType: 'Cart', aggregateId: draft.userId, version: cart.version + 1, type: 'CartItemUpdated', payload: { lineId: draft.cartLineId, snapshotId } });
  return true;
}

/** Transaction B: validates the saved version, binds a cart item to that exact snapshot, and marks the draft as in the cart. */
export async function addDraftToCart(id: string, locale = 'ar') {
  const actor = await identify();
  if (!actor.userId) throw new HttpError(401, 'يرجى تسجيل الدخول');
  return atomic(async tx => {
    const draft = await loadDraft(tx, id, actor, true);
    if (!['IN_PROGRESS', 'IN_CART'].includes(draft.status)) throw new HttpError(409, 'تغير الطلب');
    const { kind } = await serviceKind(tx, draft.serviceId), snapshot = await snapshotOf(tx, draft), config = snapshot?.data?.config ?? {};
    const validation = await validateConfig(tx, draft.serviceId, kind, config);
    if (validation.status !== 'VALID') throw new HttpError(409, validation.issues[0]?.message ?? 'تغير الطلب', { validationStatus: validation.status, issues: validation.issues });
    await lock(tx, 'cart:' + actor.userId);
    const cart = (await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${actor.userId}`)[0];
    const [line] = parseLines([{ id: draft.id, ...config, draftId: draft.id, snapshotId: draft.latestSnapshotId }]);
    const existing: any[] = cart?.body.lines ?? [], lines = [...existing.filter(l => l.id !== draft.id), line];
    if (lines.length > 40) throw new HttpError(400, 'السلة تقبل حتى 40 عنصراً');
    const quote = await quoteLines(tx, activeLines(lines), quoteOptionsFor(actor.userId, cart?.body));
    await tx.$executeRaw`INSERT INTO "CommerceCart" ("userId","body","locale","lastActivityAt") VALUES (${actor.userId},${JSON.stringify(cartBody(cart?.body, lines))}::jsonb,${locale === 'en' ? 'en' : 'ar'},CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "body"=EXCLUDED."body","locale"=EXCLUDED."locale","lastActivityAt"=CURRENT_TIMESTAMP,"version"="CommerceCart"."version"+1,"updatedAt"=CURRENT_TIMESTAMP`;
    await tx.$executeRaw`UPDATE "BookingDraft" SET "status"='IN_CART',"cartLineId"=${draft.id},"lastActivityAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${draft.id}`;
    await recordBaseline(tx, actor.userId as string, quote.lines);
    const saved = (await tx.$queryRaw<any[]>`SELECT "version" FROM "CommerceCart" WHERE "userId"=${actor.userId}`)[0];
    await emit(tx, { aggregateType: 'Cart', aggregateId: actor.userId as string, version: saved.version, type: 'CartItemAdded', payload: { lineId: draft.id, draftId: draft.id, snapshotId: draft.latestSnapshotId } });
    return { cartVersion: saved.version, lineId: draft.id, draftVersion: draft.version, quote: publicQuote(quote) };
  });
}

/** Cron: drafts nobody touched for their retention period stop appearing, but are kept (never deleted) while anything references them. */
export async function expireDrafts() {
  return prisma.$executeRaw`UPDATE "BookingDraft" SET "status"='EXPIRED',"updatedAt"=CURRENT_TIMESTAMP WHERE "status"='IN_PROGRESS' AND "expiresAt" < CURRENT_TIMESTAMP`;
}
