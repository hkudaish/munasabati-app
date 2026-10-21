import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
import { rateLimit, requireUser } from './auth';
import { ownOccasion } from './invitations';
import { emptyLayout, LayoutError, sanitizeLayout, type Layout } from '@/lib/floor-plan';

export async function readFloorPlan(occasionId: string) {
  const user = await requireUser();
  await ownOccasion(occasionId, user.id);
  const row = await prisma.occasionFloorPlan.findUnique({ where: { occasionId } });
  if (!row) return { layout: emptyLayout(), version: 0 };
  try { return { layout: sanitizeLayout(row.layout), version: row.version }; }
  catch { return { layout: emptyLayout(), version: row.version }; } // a damaged document opens as an empty hall instead of failing
}

/**
 * Saves the whole layout if `version` is still the stored one. A stale version is not an error: the caller receives the
 * newer layout and decides (the editor reloads it), so two open tabs can never silently overwrite each other.
 */
export async function saveFloorPlan(occasionId: string, input: { layout: unknown; version: unknown }) {
  const user = await requireUser();
  await rateLimit('floor-plan:' + user.id, 1500);
  await ownOccasion(occasionId, user.id);
  if (!Number.isInteger(input.version) || (input.version as number) < 0) throw new HttpError(400, 'رقم الإصدار غير صالح');
  const version = input.version as number;
  let layout: Layout;
  try { layout = sanitizeLayout(input.layout); } catch (error) { throw new HttpError(400, error instanceof LayoutError ? error.message : 'المخطط غير صالح'); }

  const saved = await prisma.$transaction(async tx => {
    if (version === 0) {
      const created = await tx.occasionFloorPlan.createMany({ data: [{ occasionId, layout: layout as object, version: 1 }], skipDuplicates: true });
      return created.count === 1 ? 1 : null;
    }
    const updated = await tx.occasionFloorPlan.updateMany({ where: { occasionId, version }, data: { layout: layout as object, version: version + 1 } });
    return updated.count === 1 ? version + 1 : null;
  });
  if (saved !== null) return { saved: true, conflict: false, version: saved };
  const current = await readFloorPlan(occasionId);
  return { saved: false, conflict: true, version: current.version, layout: current.layout };
}
