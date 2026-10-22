import { availability as geoAvailability } from '@/lib/geo/engine';
import { closedAt, DEFAULT_TZ, inTimeSlot, localParts, maintenanceAt, scheduleCap, withinOperatingHours } from './schedule';
import { CapacityStatus, Context, Decision, Message, Policy, PolicyGeoRule, Restrictions, Snapshot, Status, TraceStep } from './types';

/** How restrictive a status is. The most restrictive status in the hierarchy wins: a child can never loosen a parent. */
export const SEVERITY: Record<Status, number> = { ACTIVE: 0, PARTIALLY_AVAILABLE: 1, COMING_SOON: 2, TEMPORARILY_SUSPENDED: 3, MAINTENANCE: 4, DISABLED: 5 };
const worse = (a: Status, b: Status) => (SEVERITY[b] > SEVERITY[a] ? b : a);
const BOOKABLE: Status[] = ['ACTIVE', 'PARTIALLY_AVAILABLE'];

export const STATUS_MESSAGES: Record<Status, Message> = {
  ACTIVE: { ar: '', en: '' },
  PARTIALLY_AVAILABLE: { ar: 'الخدمة متاحة بشكل محدود', en: 'Limited availability' },
  COMING_SOON: { ar: 'قريباً؛ لا يتوفر الحجز حالياً', en: 'Coming soon; booking is not open yet' },
  TEMPORARILY_SUSPENDED: { ar: 'الخدمة موقوفة مؤقتاً', en: 'Temporarily suspended' },
  DISABLED: { ar: 'الخدمة غير متاحة حالياً', en: 'Currently unavailable' },
  MAINTENANCE: { ar: 'الخدمة قيد الصيانة حالياً', en: 'Under maintenance' },
};
export const REASON_MESSAGES: Record<string, Message> = {
  CAPACITY_REACHED: { ar: 'اكتمل الحجز في هذا الموعد؛ اختر موعداً آخر', en: 'Fully booked for this date; choose another date' },
  BOOKING_DISABLED: { ar: 'الحجز الجديد غير متاح حالياً', en: 'New bookings are not available right now' },
  LOCATION_REQUIRED: { ar: 'اختر مدينة الفعالية للتحقق من توفر الخدمة', en: 'Choose the event city to check availability' },
  GEO_UNAVAILABLE: { ar: 'الخدمة غير متاحة في المدينة المختارة', en: 'Not available in the selected city' },
  GEO_COMING_SOON: { ar: 'الخدمة قادمة قريباً إلى هذه المدينة', en: 'Coming soon to this city' },
  GEO_RULE_DENIED: { ar: 'الخدمة غير متاحة في المدينة المختارة', en: 'Not available in the selected city' },
  SERVICE_CITY_NOT_COVERED: { ar: 'الخدمة لا تغطي المدينة المختارة', en: 'The service does not cover the selected city' },
  OUTSIDE_OPERATING_HOURS: { ar: 'الموعد خارج أوقات التشغيل', en: 'Outside operating hours' },
  SCHEDULE_CLOSED: { ar: 'الخدمة مغلقة في هذا التاريخ', en: 'Closed on this date' },
  RESTRICTION_CITY: { ar: 'الخدمة متاحة لمدن محددة فقط', en: 'Only available in selected cities' },
  RESTRICTION_VENDOR: { ar: 'الحجز متاح لمقدمي خدمة محددين فقط', en: 'Only available from selected vendors' },
  RESTRICTION_OFFER: { ar: 'هذا العرض غير ضمن العروض المتاحة حالياً', en: 'This offer is not among the offers currently available' },
  RESTRICTION_TIME_SLOT: { ar: 'الحجز متاح في فترات محددة فقط', en: 'Only available in specific time slots' },
  RESTRICTION_QUANTITY: { ar: 'الكمية تتجاوز الحد المسموح', en: 'Quantity exceeds the allowed limit' },
  RESTRICTION_LEAD_TIME: { ar: 'الموعد أقرب من أقل مهلة حجز مسموحة', en: 'Too close to the date; minimum notice not met' },
  VENDOR_INACTIVE: { ar: 'مقدم الخدمة غير متاح حالياً', en: 'The vendor is currently unavailable' },
  OFFER_DISABLED: { ar: 'هذا العرض غير مفعّل حالياً', en: 'This offer is not active right now' },
  MODULE_DISABLED: { ar: 'هذه الخدمة معطلة حالياً بواسطة إدارة المنصة', en: 'This part of the platform is switched off' },
  LAUNCH_NOT_READY: { ar: 'قريباً؛ الإطلاق بانتظار اكتمال التجهيز', en: 'Coming soon; launch is waiting for readiness' },
  REVIEW_REQUIRED: { ar: 'يتطلب هذا الإجراء مراجعة الإدارة', en: 'This action needs administrator review' },
};
const GEO_BLOCKS = new Set(['GEO_UNAVAILABLE', 'GEO_COMING_SOON', 'GEO_RULE_DENIED', 'SERVICE_CITY_NOT_COVERED', 'LOCATION_REQUIRED']);

interface Layer { level: string; entityId: string; status: Status; policy?: Policy; fact?: boolean; geoDeny?: boolean; restrictions: Restrictions; message?: Message }

const active = (from?: string | null, until?: string | null, now = new Date()) => (!from || Date.parse(from) <= +now) && (!until || Date.parse(until) > +now);
function pickPolicy(snapshot: Snapshot, type: string, id: string, now: Date): Policy | undefined {
  return snapshot.policies.filter(p => p.entityType === type && p.entityId === id && active(p.effectiveFrom, p.effectiveUntil, now))
    .sort((a, b) => b.priority - a.priority || (Date.parse(b.effectiveFrom || '1970-01-01') - Date.parse(a.effectiveFrom || '1970-01-01')) || a.id.localeCompare(b.id))[0];
}
/** The geographic rule that applies at a place: most specific wins (city > region > country); DENY beats ALLOW at equal specificity; INHERIT defers. */
export function matchGeoRule(rules: PolicyGeoRule[], place: { cityId?: string | null; regionId?: string | null; countryCode?: string | null }, now: Date): PolicyGeoRule | null {
  const live = rules.filter(r => active(r.effectiveFrom, r.effectiveUntil, now));
  const levels = [
    live.filter(r => r.cityId && r.cityId === place.cityId),
    live.filter(r => !r.cityId && r.regionId && r.regionId === place.regionId),
    live.filter(r => !r.cityId && !r.regionId && r.countryCode && r.countryCode === place.countryCode),
  ];
  for (const group of levels) {
    if (!group.length) continue;
    const deny = group.find(r => r.geographicEffect === 'DENY');
    if (deny) return deny;
    const allow = group.find(r => r.geographicEffect === 'ALLOW');
    if (allow) return allow;
  }
  return null;
}
const merge = (a: Restrictions, b?: Restrictions): Restrictions => ({ ...a, ...(b ?? {}) });

export function resolve(snapshot: Snapshot, ctx: Context, now: Date = new Date()): Decision {
  const intent = ctx.intent ?? 'VIEW', quantity = ctx.quantity ?? 1, units = ctx.bookingUnits ?? 1; // quantity: units of the offer; units: bookings taking capacity
  const moduleId = ctx.moduleId ?? 'commerce';
  const role = ctx.serviceKind === 'DIGITAL' ? 'NONE' : ctx.serviceKind === 'PHYSICAL' ? 'DELIVERY' : 'EVENT';
  const trace: TraceStep[] = [];
  const reasons: string[] = [];
  const blocking = new Set<string>();
  const city = ctx.cityId ? snapshot.geo.cities.find(c => c.id === ctx.cityId) : undefined;
  const place = { cityId: ctx.cityId ?? null, regionId: city?.regionId ?? null, countryCode: ctx.countryCode ?? city?.countryCode ?? null };
  const today = localParts(now, DEFAULT_TZ).date;
  const note = (layer: string, text: string, extra: Partial<TraceStep> = {}) => trace.push({ layer, note: text, ...extra });

  // ---- 1. the hierarchy: platform > module > category > service > vendor > offer > package ----
  const chain: [string, string | null | undefined][] = [['PLATFORM', 'platform'], ['MODULE', moduleId], ['CATEGORY', ctx.categoryId], ['SERVICE', ctx.serviceId], ['VENDOR', ctx.vendorId], ['OFFER', ctx.offerId], ['PACKAGE', ctx.packageId]];
  const layers: Layer[] = [];
  const policies: Policy[] = [];
  const policyLevel = new Map<string, string>();
  for (const [level, entityId] of chain) {
    if (!entityId) continue;
    const policy = pickPolicy(snapshot, level, entityId, now);
    if (!policy) { note(level, 'لا توجد سياسة؛ يُفترض ACTIVE', { entityId, status: 'ACTIVE' }); continue; }
    policies.push(policy); policyLevel.set(policy.id, level);
    let status = policy.configuredStatus, restrictions = merge({}, policy.restrictionConfig), message: Message | undefined = policy.publicMessage.ar || policy.publicMessage.en ? { ar: policy.publicMessage.ar ?? '', en: policy.publicMessage.en ?? '' } : undefined;
    // scheduled activation: only the COMING_SOON policy itself changes, and only after the launch date and a readiness check
    if (status === 'COMING_SOON' && policy.autoActivate && policy.restrictionConfig.launchDate && policy.restrictionConfig.launchDate <= today) {
      if (level !== 'SERVICE' || ctx.serviceReady !== false) { status = 'ACTIVE'; note(level, 'تفعيل مجدول بعد تاريخ الإطلاق', { entityId, policyId: policy.id, status }); }
      else reasons.push('LAUNCH_NOT_READY');
    }
    // the policy's own places: the most specific rule decides, and may override the status or add restrictions there
    let geoDeny = false;
    if (policy.geoRules.length && (ctx.cityId || place.countryCode)) {
      const rule = matchGeoRule(policy.geoRules, place, now);
      if (rule) {
        if (rule.geographicEffect === 'DENY') { geoDeny = true; status = 'DISABLED'; reasons.push('GEO_RULE_DENIED'); }
        else if (rule.statusOverride) status = rule.statusOverride;
        restrictions = merge(restrictions, rule.restrictionConfig);
        note(level, `قاعدة جغرافية ${rule.geographicEffect}${rule.statusOverride ? ' → ' + rule.statusOverride : ''}`, { entityId, policyId: policy.id, status });
      }
    }
    // a maintenance window that is running now
    const maintenance = maintenanceAt(policy.schedules, now);
    if (maintenance) { status = worse(status, 'MAINTENANCE'); note(level, 'نافذة صيانة مجدولة جارية', { entityId, policyId: policy.id, status }); }
    layers.push({ level, entityId, status, policy, geoDeny, restrictions, message });
    note(level, `الحالة المضبوطة ${policy.configuredStatus}`, { entityId, policyId: policy.id, status });
  }
  // existing records are part of the hierarchy too: switched-off modules, inactive vendors, disabled offers
  const moduleRow = snapshot.geo.services.find(s => s.key === 'feature:' + moduleId);
  if (moduleRow && !moduleRow.enabled) { layers.push({ level: 'MODULE', entityId: moduleId, status: 'DISABLED', fact: true, restrictions: {} }); reasons.push('MODULE_DISABLED'); note('MODULE', 'الوحدة معطلة من إعدادات الميزات', { entityId: moduleId, status: 'DISABLED' }); }
  if (ctx.vendorActive === false) { layers.push({ level: 'VENDOR', entityId: ctx.vendorId ?? '', status: 'DISABLED', fact: true, restrictions: {} }); reasons.push('VENDOR_INACTIVE'); note('VENDOR', 'المورد غير نشط', { status: 'DISABLED' }); }
  if (ctx.offerEnabled === false) { layers.push({ level: 'OFFER', entityId: ctx.offerId ?? '', status: 'DISABLED', fact: true, restrictions: {} }); reasons.push('OFFER_DISABLED'); note('OFFER', 'العرض غير مفعّل', { status: 'DISABLED' }); }

  // ---- 2. coverage by place (the existing city/service rules), judged by the SERVICE location, never the visitor's ----
  let needsLocation = false, geoStatus: Status = 'ACTIVE', geoMessage: Message | undefined;
  if (role !== 'NONE') {
    if (!ctx.cityId) {
      if (snapshot.geo.policy.unknownCity !== 'ALLOW') { needsLocation = true; if (intent !== 'VIEW') { reasons.push('LOCATION_REQUIRED'); blocking.add('LOCATION_REQUIRED'); } note('GEO', 'لا توجد مدينة للخدمة؛ لا يُمنح الوصول ضمنياً'); }
    } else {
      const rows = geoAvailability(snapshot.geo, { cityId: ctx.cityId, countryCode: place.countryCode, source: 'MANUAL' }, now);
      const keys = ['feature:' + moduleId, ...(ctx.categoryId ? ['category:' + ctx.categoryId] : []), ...(ctx.legacyServiceId ? ['item:' + ctx.legacyServiceId] : [])];
      for (const key of keys) {
        const row = rows.find(r => r.key === key);
        if (!row || row.available) continue;
        const status: Status = row.status === 'SOON' ? 'COMING_SOON' : 'DISABLED';
        const code = row.status === 'SOON' ? 'GEO_COMING_SOON' : 'GEO_UNAVAILABLE';
        reasons.push(code); if (SEVERITY[status] > SEVERITY[geoStatus]) { geoStatus = status; geoMessage = { ar: row.message || row.reason || REASON_MESSAGES[code].ar, en: REASON_MESSAGES[code].en }; }
        note('GEO', `${key}: ${row.status}`, { status });
      }
      if (ctx.serviceCities && !ctx.serviceCities.includes(ctx.cityId)) { reasons.push('SERVICE_CITY_NOT_COVERED'); geoStatus = worse(geoStatus, 'DISABLED'); geoMessage ??= REASON_MESSAGES.SERVICE_CITY_NOT_COVERED; note('GEO', 'المدينة خارج تغطية الخدمة', { status: 'DISABLED' }); }
    }
    if (geoStatus !== 'ACTIVE') layers.push({ level: 'GEO', entityId: ctx.cityId ?? '', status: geoStatus, fact: true, restrictions: {}, message: geoMessage });
  } else note('GEO', 'خدمة رقمية: لا قيد جغرافي ضمني');

  // ---- 3. effective status ----
  let effective: Status = 'ACTIVE';
  for (const layer of layers) effective = worse(effective, layer.status);
  const own = layers.find(l => l.policy && l.level === (ctx.entityType === 'MODULE' ? 'MODULE' : ctx.entityType) );
  const configured: Status = own?.policy?.configuredStatus ?? 'ACTIVE';

  // ---- 4. schedules, restrictions, capacity ----
  const checksDate = intent === 'BOOK' || intent === 'CHECKOUT' || intent === 'MODIFY' || (intent === 'VIEW' && !!ctx.bookingDate);
  const schedules = policies.flatMap(p => p.schedules);
  const restrictions: Restrictions = {};
  const caps: { level: string; limit: number }[] = [];
  const takeCap = (level: string, n: number | null | undefined) => { if (n != null) caps.push({ level, limit: n }); };
  for (const layer of layers) {
    const conditional = layer.status === 'PARTIALLY_AVAILABLE' || layer.policy?.bookingMode === 'CONDITIONAL';
    if (layer.policy && layer.policy.bookingMode === 'DISABLED' && intent !== 'CONFIRM') { reasons.push('BOOKING_DISABLED'); blocking.add('BOOKING_DISABLED'); }
    if (!conditional && !layer.restrictions.maxBookingsPerDay) continue;
    const r = layer.restrictions;
    Object.assign(restrictions, Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'launchDate')));
    takeCap(layer.level, r.maxBookingsPerDay);
    if (!conditional || intent === 'CONFIRM') continue;
    const violate = (code: string) => { reasons.push(code); blocking.add(code); note(layer.level, 'مخالفة قيد: ' + code, { entityId: layer.entityId, policyId: layer.policy?.id }); };
    if (r.cities?.length && ctx.cityId && !r.cities.includes(ctx.cityId)) violate('RESTRICTION_CITY');
    if (r.vendorIds?.length && ctx.vendorId && !r.vendorIds.includes(ctx.vendorId)) violate('RESTRICTION_VENDOR');
    if (r.offerIds?.length && ctx.offerId && !r.offerIds.includes(ctx.offerId)) violate('RESTRICTION_OFFER');
    if (r.maxQuantity != null && quantity > r.maxQuantity) violate('RESTRICTION_QUANTITY');
    if (r.allowedTimeSlots?.length && ctx.bookingTime && !inTimeSlot(r.allowedTimeSlots, ctx.bookingTime)) violate('RESTRICTION_TIME_SLOT');
    if (r.minLeadHours != null && ctx.bookingDate) { const when = Date.parse(`${ctx.bookingDate}T${ctx.bookingTime ?? '00:00'}:00+03:00`); if (Number.isFinite(when) && when - +now < r.minLeadHours * 3600000) violate('RESTRICTION_LEAD_TIME'); }
  }
  if (checksDate && ctx.bookingDate) {
    const closure = closedAt(schedules, ctx.bookingDate, ctx.bookingTime);
    if (closure) { reasons.push('SCHEDULE_CLOSED'); blocking.add('SCHEDULE_CLOSED'); note('SCHEDULE', `إغلاق ${closure.kind}`); }
    for (const policy of policies) {
      const inside = withinOperatingHours(policy.schedules, ctx.bookingDate, ctx.bookingTime);
      if (inside === false) { reasons.push('OUTSIDE_OPERATING_HOURS'); blocking.add('OUTSIDE_OPERATING_HOURS'); note('SCHEDULE', 'خارج نافذة التشغيل', { policyId: policy.id }); }
      takeCap(policyLevel.get(policy.id) ?? 'SERVICE', scheduleCap(policy.schedules, ctx.bookingDate, ctx.bookingTime));
    }
  }
  // capacity is independent of the configured status: a full service stays ACTIVE, it just cannot take this booking
  let capacityStatus: CapacityStatus = 'AVAILABLE', remaining: number | null = null;
  const rank: Record<CapacityStatus, number> = { AVAILABLE: 0, LIMITED: 1, FULL: 2, UNAVAILABLE: 3 };
  for (const cap of caps) {
    // every limit is judged against the bookings counted for ITS scope (service, offer, vendor, category ...)
    const used = ctx.usedByScope?.[cap.level] ?? ctx.usedBookings ?? 0, left = Math.max(0, cap.limit - used);
    let status: CapacityStatus = 'AVAILABLE';
    if (cap.limit === 0) status = 'UNAVAILABLE';
    else if (used + units > cap.limit) status = 'FULL';
    else if (left <= Math.max(1, Math.ceil(cap.limit * 0.2))) status = 'LIMITED';
    if (rank[status] > rank[capacityStatus] || (status === capacityStatus && (remaining == null || left < remaining))) { capacityStatus = status; remaining = left; }
    else if (remaining == null) remaining = left;
  }
  if ((capacityStatus === 'FULL' || capacityStatus === 'UNAVAILABLE') && intent !== 'CONFIRM' && (ctx.bookingDate || intent === 'VIEW')) { reasons.push('CAPACITY_REACHED'); if (ctx.bookingDate) blocking.add('CAPACITY_REACHED'); }

  // ---- 5. may new work happen? ----
  const statusBlocks = !BOOKABLE.includes(effective);
  let statusAllows = !statusBlocks;
  if (statusBlocks && (intent === 'CONFIRM' || intent === 'MODIFY')) {
    // existing bookings continue unless the responsible policy says otherwise; platform maintenance is for administrators only
    const worst = layers.filter(l => l.status === effective && !l.fact).at(-1) ?? layers.filter(l => l.status === effective).at(-1);
    const hardMaintenance = effective === 'MAINTENANCE' && !!worst && (worst.level === 'PLATFORM' || worst.level === 'MODULE');
    const mode = worst?.policy?.suspensionPolicy.existingBookings ?? 'CONTINUE';
    if (worst?.fact && worst.level !== 'GEO') statusAllows = false; // a switched-off module/vendor/offer is not bypassed
    else if (hardMaintenance) statusAllows = !!ctx.actorIsAdmin;
    else if (mode === 'CONTINUE') statusAllows = true;
    else if (mode === 'REVIEW') { statusAllows = !!ctx.actorIsAdmin; if (!statusAllows) reasons.push('REVIEW_REQUIRED'); }
    else statusAllows = false;
    note('STATUS', `حجز قائم (${intent}) تحت ${effective}: ${mode}${hardMaintenance ? ' (صيانة المنصة)' : ''} → ${statusAllows ? 'مسموح' : 'ممنوع'}`);
  }
  const canBook = intent === 'VIEW' ? !statusBlocks && blocking.size === 0 : statusAllows && blocking.size === 0;
  // keep reason codes unique and in the order they were found
  const reasonCodes = Array.from(new Set(reasons));
  if (effective !== 'ACTIVE' && effective !== 'PARTIALLY_AVAILABLE' && !reasonCodes.some(r => r.endsWith(effective))) reasonCodes.unshift('STATUS_' + effective);
  if (effective === 'PARTIALLY_AVAILABLE') reasonCodes.unshift('LIMITED_AVAILABILITY');

  // ---- 6. visibility ----
  let isVisible = true;
  const policyLayers = layers.filter(l => l.policy);
  if (policyLayers.some(l => l.policy!.visibilityMode === 'HIDDEN')) isVisible = false;
  else if (!(own?.policy?.visibilityMode === 'VISIBLE')) {
    if (layers.some(l => !l.fact && l.status === 'DISABLED') || layers.some(l => l.fact && l.status === 'DISABLED' && l.level !== 'GEO')) isVisible = false;
    else if (layers.some(l => l.level === 'GEO' && l.status !== 'ACTIVE') && snapshot.geo.policy.hideUnavailable && ctx.cityId && geoStatus === 'DISABLED') isVisible = false;
  }

  // ---- 7. message ----
  const worstLayer = layers.filter(l => l.status === effective && l.status !== 'ACTIVE').at(-1);
  const primary = reasonCodes.find(r => REASON_MESSAGES[r] && r !== 'LIMITED_AVAILABILITY');
  const pickMessage = (): Message => {
    if (worstLayer?.message && (worstLayer.message.ar || worstLayer.message.en)) return { ar: worstLayer.message.ar || STATUS_MESSAGES[effective].ar, en: worstLayer.message.en || STATUS_MESSAGES[effective].en };
    if (effective !== 'ACTIVE') {
      if (primary && GEO_BLOCKS.has(primary) && geoMessage) return geoMessage;
      if (primary && (primary.startsWith('MODULE') || primary.startsWith('VENDOR') || primary.startsWith('OFFER') || primary === 'LAUNCH_NOT_READY' || primary === 'GEO_RULE_DENIED')) return REASON_MESSAGES[primary];
      return STATUS_MESSAGES[effective];
    }
    const block = Array.from(blocking)[0];
    if (block && REASON_MESSAGES[block]) return REASON_MESSAGES[block];
    if (reasonCodes.includes('CAPACITY_REACHED')) return REASON_MESSAGES.CAPACITY_REACHED;
    return { ar: '', en: '' };
  };
  const messageOut = pickMessage();
  const launch = layers.map(l => l.policy?.restrictionConfig.launchDate).find(Boolean), resume = layers.map(l => l.policy?.suspensionPolicy.expectedResumeDate).find(Boolean);
  return {
    configuredStatus: configured, effectiveStatus: effective, isVisible, canBook, canCheckout: canBook, capacityStatus, remainingCapacity: remaining,
    reasonCodes, restrictions, message: messageOut, needsLocation, ...(launch && (effective === 'COMING_SOON') ? { launchDate: launch } : {}), ...(resume && (effective === 'TEMPORARILY_SUSPENDED') ? { expectedResumeDate: resume } : {}), trace,
  };
}
