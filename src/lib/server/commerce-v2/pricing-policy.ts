import 'server-only';
import { randomUUID } from 'node:crypto';
import { Tx, lock } from '../booking/repository';
import { PackagePolicy } from '@/lib/commerce/pricing-engine';
import { loadPolicy, policyFromRow } from './pricing';

/** The package's own price/discount fields mirror its active policy, so the older editor and any reader of those fields stay truthful. */
export async function mirrorToPackage(tx: Tx, packageId: string, policy: PackagePolicy) {
  const fixedTotal = policy.model === 'FIXED_PRICE' ? policy.fixedPrice ?? 0 : 0, discountBps = policy.model === 'PERCENT' ? policy.discountBps ?? 0 : 0;
  await tx.$executeRaw`UPDATE "CommercePackage" SET "body"="body" || ${JSON.stringify({ fixedTotal, discountBps })}::jsonb WHERE "id"=${packageId}`;
}
/** Makes `policyId` the policy in force from its start: a policy it overlaps ends when the new one begins (or is archived if it started no earlier). */
export async function activate(tx: Tx, packageId: string, policyId: string) {
  const mine = (await tx.$queryRaw<any[]>`SELECT * FROM "PackagePricingPolicy" WHERE "id"=${policyId}`)[0];
  const others = await tx.$queryRaw<any[]>`SELECT * FROM "PackagePricingPolicy" WHERE "packageId"=${packageId} AND "status"='ACTIVE' AND "id" <> ${policyId} AND "effectiveFrom" < COALESCE(${mine.effectiveUntil}::timestamptz,'infinity'::timestamptz) AND ${mine.effectiveFrom}::timestamptz < COALESCE("effectiveUntil",'infinity'::timestamptz)`;
  for (const o of others) {
    if (+new Date(o.effectiveFrom) < +new Date(mine.effectiveFrom)) await tx.$executeRaw`UPDATE "PackagePricingPolicy" SET "effectiveUntil"=${mine.effectiveFrom} WHERE "id"=${o.id}`;
    else await tx.$executeRaw`UPDATE "PackagePricingPolicy" SET "status"='ARCHIVED' WHERE "id"=${o.id}`;
  }
  await tx.$executeRaw`UPDATE "PackagePricingPolicy" SET "status"='ACTIVE' WHERE "id"=${policyId}`;
  if (+new Date(mine.effectiveFrom) <= Date.now()) await mirrorToPackage(tx, packageId, policyFromRow({ ...mine, status: 'ACTIVE' }));
}
/** A package saved in the older editor with a different fixed total / percentage becomes a new policy version, so the two can never disagree. */
export async function syncLegacyPolicy(tx: Tx, packageId: string, body: any, user: any) {
  const pack = (await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackage" WHERE "id"=${packageId}`)[0];
  const current = await loadPolicy(tx, pack, new Date()), hasRows = (await tx.$queryRaw<any[]>`SELECT 1 FROM "PackagePricingPolicy" WHERE "packageId"=${packageId} LIMIT 1`).length > 0;
  const mirrorFixed = current.model === 'FIXED_PRICE' ? current.fixedPrice ?? 0 : 0, mirrorBps = current.model === 'PERCENT' ? current.discountBps ?? 0 : 0;
  if (hasRows && (body.fixedTotal ?? 0) === mirrorFixed && (body.discountBps ?? 0) === mirrorBps) return;
  await lock(tx, 'pricing-policy:' + packageId);
  const model = (body.fixedTotal ?? 0) > 0 ? 'FIXED_PRICE' : (body.discountBps ?? 0) > 0 ? 'PERCENT' : 'SUM';
  const version = (await tx.$queryRaw<any[]>`SELECT COALESCE(MAX("version"),0)::int AS v FROM "PackagePricingPolicy" WHERE "packageId"=${packageId}`)[0].v + 1, id = randomUUID();
  await tx.$executeRaw`INSERT INTO "PackagePricingPolicy" ("id","packageId","pricingModel","currency","fixedPrice","discountPercentage","config","effectiveFrom","version","status","createdBy") VALUES (${id},${packageId},${model},'SAR',${model === 'FIXED_PRICE' ? body.fixedTotal : null},${model === 'PERCENT' ? body.discountBps / 100 : null},'{}'::jsonb,CURRENT_TIMESTAMP,${version},'DRAFT',${user.id})`;
  await activate(tx, packageId, id);
}

