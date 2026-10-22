import { resolve } from './resolver';
import type { Context, Decision, Snapshot } from './types';

/** A package is bookable when every REQUIRED component can be fulfilled, directly or through a permitted substitute that the
    customer selected. An unavailable OPTIONAL component never disables the package: it is left out and reported. */
export interface PackageComponent { key: string; optional: boolean; primary: Context; substitutes?: { id: string; context: Context }[] }
export type ComponentState = 'AVAILABLE' | 'SUBSTITUTED' | 'NEEDS_SUBSTITUTE' | 'OMITTED' | 'UNAVAILABLE';
export interface ComponentResult { key: string; optional: boolean; state: ComponentState; decision: Decision; substituteId?: string; substituteOptions: string[] }
export interface PackageResult { bookable: boolean; packageDecision: Decision; components: ComponentResult[]; blocking: string[]; omitted: string[] }

export function evaluatePackage(snapshot: Snapshot, pkg: Context, components: PackageComponent[], choices: Record<string, { substituteId?: string }> = {}, now = new Date()): PackageResult {
  const packageDecision = resolve(snapshot, { ...pkg, entityType: 'PACKAGE' }, now);
  const results: ComponentResult[] = [];
  for (const component of components) {
    const primary = resolve(snapshot, component.primary, now);
    if (primary.canBook) { results.push({ key: component.key, optional: component.optional, state: 'AVAILABLE', decision: primary, substituteOptions: [] }); continue; }
    const viable = (component.substitutes ?? []).map(s => ({ id: s.id, decision: resolve(snapshot, s.context, now) })).filter(s => s.decision.canBook);
    const chosen = choices[component.key]?.substituteId;
    const picked = chosen ? viable.find(s => s.id === chosen) : undefined;
    if (picked) results.push({ key: component.key, optional: component.optional, state: 'SUBSTITUTED', decision: picked.decision, substituteId: picked.id, substituteOptions: viable.map(s => s.id) });
    else if (component.optional) results.push({ key: component.key, optional: true, state: 'OMITTED', decision: primary, substituteOptions: viable.map(s => s.id) });
    else results.push({ key: component.key, optional: false, state: viable.length ? 'NEEDS_SUBSTITUTE' : 'UNAVAILABLE', decision: primary, substituteOptions: viable.map(s => s.id) });
  }
  const blocking = results.filter(r => !r.optional && (r.state === 'NEEDS_SUBSTITUTE' || r.state === 'UNAVAILABLE')).map(r => r.key);
  return { bookable: packageDecision.canBook && blocking.length === 0, packageDecision, components: results, blocking, omitted: results.filter(r => r.state === 'OMITTED').map(r => r.key) };
}
