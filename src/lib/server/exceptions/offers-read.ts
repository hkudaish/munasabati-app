import 'server-only';
import { Tx } from '../booking/repository';

/** The offer the customer accepted for an exception (the newest accepted version), or null. Read-only: shared by the cart, orders and the workflow. */
export async function acceptedOffer(tx: Tx, exceptionId: string): Promise<{ id: string; version: number; startAt: Date; baseAmount: number; exceptionFee: number; discount: number; vatAmount: number; total: number; previousTotal: number; terms: any } | null> {
  const rows = await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionOffer" WHERE "requestId"=${exceptionId} AND "status"='ACCEPTED' ORDER BY "version" DESC LIMIT 1`;
  return rows[0] ?? null;
}
