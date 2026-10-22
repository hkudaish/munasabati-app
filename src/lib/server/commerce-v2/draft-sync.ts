import 'server-only';
import { Tx } from '../booking/repository';

/** After the cart changes: drafts whose item left the cart go back to "in progress" so the customer can still finish them. */
export async function syncDraftsWithCart(tx: Tx, userId: string, lineIds: string[], purchased: string[] = []) {
  if (purchased.length) await tx.$executeRaw`UPDATE "BookingDraft" SET "status"='PURCHASED',"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId} AND "status"='IN_CART' AND "cartLineId" = ANY(${purchased})`;
  await tx.$executeRaw`UPDATE "BookingDraft" SET "status"='IN_PROGRESS',"cartLineId"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId} AND "status"='IN_CART' AND NOT ("cartLineId" = ANY(${lineIds}))`;
}
