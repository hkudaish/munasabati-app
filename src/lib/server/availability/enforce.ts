import 'server-only';
import { HttpError } from '@/lib/server/http';
import { lock, Tx } from '@/lib/server/booking/repository';
import { resolve } from '@/lib/availability/resolver';
import type { Context, Decision, Snapshot } from '@/lib/availability/types';
import { BuildInput, cappedScopes, chainOf, countByScope, offerFacts, OfferFacts, toContext } from './facts';
import { loadSnapshot } from './loader';

/** What a public caller may see: no policy ids, no trace, no exact remaining capacity. */
export function publicDecision(d: Decision) {
  return { configuredStatus: d.configuredStatus, effectiveStatus: d.effectiveStatus, isVisible: d.isVisible, canBook: d.canBook, canCheckout: d.canCheckout, capacityStatus: d.capacityStatus, reasonCodes: d.reasonCodes, restrictions: d.restrictions, message: d.message, needsLocation: d.needsLocation, ...(d.launchDate ? { launchDate: d.launchDate } : {}), ...(d.expectedResumeDate ? { expectedResumeDate: d.expectedResumeDate } : {}) };
}
const CONFLICT_CODES = new Set(['CAPACITY_REACHED', 'OUTSIDE_OPERATING_HOURS', 'SCHEDULE_CLOSED', 'RESTRICTION_CITY', 'RESTRICTION_VENDOR', 'RESTRICTION_OFFER', 'RESTRICTION_TIME_SLOT', 'RESTRICTION_QUANTITY', 'RESTRICTION_LEAD_TIME']);
const log = (event: string, fields: Record<string, unknown>) => console.warn(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));

export interface Loaded { decision: Decision; facts: OfferFacts; ctx: Context }
// Inside one transaction the policies, the geography and an offer's facts cannot change underneath us (the transaction is serializable),
// so a cart with many lines reads them once instead of once per line. Outside a transaction nothing is cached.
const perTx = new WeakMap<object, { snapshot?: Promise<Snapshot>; facts: Map<string, Promise<OfferFacts | null>> }>();
const isTx = (db: object) => !('$transaction' in db);
function memo(tx: Tx) { let m = perTx.get(tx); if (!m) { m = { facts: new Map() }; perTx.set(tx, m); } return m; }
const snapshotOf = (tx: Tx) => { if (!isTx(tx)) return loadSnapshot(tx); const m = memo(tx); return (m.snapshot ??= loadSnapshot(tx)); };
const factsOf = (tx: Tx, id: string) => { if (!isTx(tx)) return offerFacts(tx, id); const m = memo(tx); let f = m.facts.get(id); if (!f) { f = offerFacts(tx, id); m.facts.set(id, f); } return f; };
/** Resolves one offer at a place and time. Inside a booking transaction it first takes the capacity locks of every capped scope, so two
    simultaneous bookings are counted one after the other and the cap can never be exceeded. */
export async function decideOffering(tx: Tx, input: BuildInput): Promise<Loaded | null> {
  const facts = await factsOf(tx, input.offeringId);
  if (!facts) return null;
  const ctx = toContext(facts, input);
  const snapshot = await snapshotOf(tx);
  const intent = input.intent ?? 'VIEW';
  if (input.date && (intent === 'BOOK' || intent === 'MODIFY' || intent === 'CHECKOUT')) {
    const chain = chainOf(facts, ctx.moduleId, input.packageId);
    const scopes = cappedScopes(snapshot, chain);
    if (!input.noLock) for (const scope of scopes) await lock(tx, `availability:${scope}:${chain[scope] ?? ''}:${input.date}`);
    if (scopes.length) ctx.usedByScope = await countByScope(tx, scopes, input.date, facts, ctx, input.excludeRequestId, input.packageId);
  }
  return { decision: resolve(snapshot, ctx, new Date()), facts, ctx };
}

/** The single gate every booking path goes through: throws when the policy hierarchy, the place, the schedule or the capacity says no. */
export async function assertBookable(tx: Tx, input: BuildInput): Promise<Loaded | null> {
  let loaded: Loaded | null;
  try { loaded = await decideOffering(tx, input); }
  catch (error) { log('availability.resolution_failed', { offeringId: input.offeringId, cityId: input.cityId, error: error instanceof Error ? error.message : String(error) }); throw error; }
  if (!loaded) return null;
  const { decision } = loaded;
  if (!decision.canBook) {
    const conflict = decision.reasonCodes.some(c => CONFLICT_CODES.has(c));
    log('availability.booking_denied', { offeringId: input.offeringId, cityId: input.cityId, date: input.date, intent: input.intent, effectiveStatus: decision.effectiveStatus, reasonCodes: decision.reasonCodes });
    throw new HttpError(conflict ? 409 : 403, decision.message.ar || 'الخدمة غير متاحة للحجز حالياً', { reasonCodes: decision.reasonCodes, availability: publicDecision(decision) });
  }
  return loaded;
}
