import 'server-only';
import { prisma } from '@/lib/db';
import { translateToEnglish, translationEnabled } from '../translate';

type Kind = 'SERVICE' | 'OFFER' | 'PACKAGE';
/** Which English fields each kind carries, and the Arabic source and length limit of each. */
const FIELDS: Record<Kind, { en: string; ar: string; max: number }[]> = {
  SERVICE: [{ en: 'titleEn', ar: 'titleAr', max: 200 }, { en: 'descriptionEn', ar: 'descriptionAr', max: 8000 }],
  OFFER: [{ en: 'nameEn', ar: 'nameAr', max: 200 }],
  PACKAGE: [{ en: 'nameEn', ar: 'nameAr', max: 200 }, { en: 'descriptionEn', ar: 'descriptionAr', max: 8000 }],
};
const missing = (kind: Kind, body: any) => FIELDS[kind].filter(f => typeof body?.[f.ar] === 'string' && body[f.ar].trim() && !(typeof body?.[f.en] === 'string' && body[f.en].trim()));

async function rows(kind: Kind, id?: string, limit = 200): Promise<{ id: string; body: any }[]> {
  const only = id ?? null;
  if (kind === 'SERVICE') return prisma.$queryRaw`SELECT "id","body" FROM "CommerceService" WHERE (${only}::text IS NULL OR "id"=${only}) ORDER BY "createdAt" LIMIT ${limit}`;
  if (kind === 'OFFER') return prisma.$queryRaw`SELECT "id","body" FROM "CommerceOffer" WHERE (${only}::text IS NULL OR "id"=${only}) ORDER BY "createdAt" LIMIT ${limit}`;
  return prisma.$queryRaw`SELECT "id","body" FROM "CommercePackage" WHERE (${only}::text IS NULL OR "id"=${only}) ORDER BY "createdAt" LIMIT ${limit}`;
}
/** Merges the English fields into the stored body without touching its version: the English name is display text, not a commercial term. */
async function store(kind: Kind, id: string, patch: Record<string, unknown>) {
  const json = JSON.stringify({ ...patch, enAuto: true });
  if (kind === 'SERVICE') await prisma.$executeRaw`UPDATE "CommerceService" SET "body"="body" || ${json}::jsonb WHERE "id"=${id}`;
  else if (kind === 'OFFER') await prisma.$executeRaw`UPDATE "CommerceOffer" SET "body"="body" || ${json}::jsonb WHERE "id"=${id}`;
  else await prisma.$executeRaw`UPDATE "CommercePackage" SET "body"="body" || ${json}::jsonb WHERE "id"=${id}`;
}
/** Translates what is missing for one record. Never throws: a failed translation leaves the record as it was. Returns whether anything was filled. */
export async function autoTranslateEntity(kind: Kind, id: string, row?: { id: string; body: any }): Promise<boolean> {
  if (!translationEnabled()) return false;
  try {
    const record = row ?? (await rows(kind, id, 1))[0];
    if (!record) return false;
    const need = missing(kind, record.body);
    if (!need.length) return false;
    const out = await translateToEnglish(Object.fromEntries(need.map(f => [f.en, record.body[f.ar]])), Object.fromEntries(need.map(f => [f.en, f.max])), 8000); // short timeout: this runs while a vendor waits for a save or an administrator's batch
    if (!Object.keys(out).length) return false;
    await store(kind, record.id, out);
    return true;
  } catch (error) { console.warn(JSON.stringify({ event: 'translate.failed', kind, id, error: error instanceof Error ? error.message : String(error) })); return false; }
}
const KINDS: Kind[] = ['SERVICE', 'OFFER', 'PACKAGE'];
const pending = async (kind: Kind) => (await rows(kind, undefined, 5000)).filter(r => missing(kind, r.body).length);
/** Fills English for existing services, offers and packages that lack it, up to `batch` records per call (administrators repeat until `remaining` is 0). */
export async function backfillEnglish(batch = 25) {
  let filled = 0, failed = 0, budget = batch;
  for (const kind of KINDS) {
    for (const row of (await pending(kind)).slice(0, budget)) { (await autoTranslateEntity(kind, row.id, row)) ? filled++ : failed++; budget--; }
    if (budget <= 0) break;
  }
  const remaining = (await Promise.all(KINDS.map(async k => (await pending(k)).length))).reduce((a, b) => a + b, 0);
  return { filled, failed, remaining };
}
