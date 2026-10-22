// Pure unit tests of the availability engine (no database): node scripts/test-availability-engine.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const Module = require('node:module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) { if (request.startsWith('@/')) request = path.join(root, 'src', request.slice(2)); return originalResolve.call(this, request, ...rest); };
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(output.outputText, filename);
};
const { resolve, matchGeoRule, SEVERITY } = require('../src/lib/availability/resolver.ts');
const { evaluatePackage } = require('../src/lib/availability/package.ts');
const { validatePolicy, canTransition, PolicyError, TRANSITIONS } = require('../src/lib/availability/states.ts');
const { windowCovers, withinOperatingHours, closedAt, maintenanceAt, localParts } = require('../src/lib/availability/schedule.ts');

const NOW = new Date('2026-12-01T09:00:00Z'); // 12:00 in Riyadh
const geo = (extra = {}) => ({
  revision: 1, regions: [], categories: [],
  countries: [{ code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', aliases: [], enabled: true, version: 1 }],
  cities: [
    { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: '', regionId: 'r-riyadh', countryCode: 'SA', aliases: [], isAvailable: true, defaultAvailable: true, version: 1 },
    { id: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', regionAr: '', regionId: 'r-makkah', countryCode: 'SA', aliases: [], isAvailable: true, defaultAvailable: true, version: 1 },
    { id: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam', regionAr: '', regionId: 'r-east', countryCode: 'SA', aliases: [], isAvailable: true, defaultAvailable: true, version: 1 },
    { id: 'khobar', nameAr: 'الخبر', nameEn: 'Khobar', regionAr: '', regionId: 'r-east', countryCode: 'SA', aliases: [], isAvailable: true, defaultAvailable: true, version: 1 },
  ],
  services: [{ key: 'feature:commerce', id: 'commerce', name: 'x', kind: 'feature', enabled: true, visible: true }, { key: 'category:photo', id: 'photo', name: 'x', kind: 'category', enabled: true, visible: true }, { key: 'item:legacy-1', id: 'legacy-1', name: 'x', kind: 'item', enabled: true, visible: true, cityId: 'riyadh' }],
  rules: [], policy: { unknownCity: 'PROMPT', hideUnavailable: true, analyticsEnabled: false, reverseEnabled: false, ipEnabled: true }, ...extra,
});
let n = 0;
const policy = (entityType, entityId, over = {}) => ({ id: 'p' + ++n, entityType, entityId, configuredStatus: 'ACTIVE', visibilityMode: 'AUTO', bookingMode: 'ENABLED', priority: 0, restrictionConfig: {}, suspensionPolicy: {}, publicMessage: {}, effectiveFrom: null, effectiveUntil: null, autoActivate: false, version: 1, geoRules: [], schedules: [], ...over });
const snap = (policies = [], g = geo()) => ({ policies, geo: g });
const ctx = (over = {}) => ({ entityType: 'SERVICE', serviceId: 'svc', categoryId: 'photo', vendorId: 'v1', offerId: 'o1', cityId: 'riyadh', serviceKind: 'BOOKABLE', bookingDate: '2026-12-15', bookingTime: '18:00', intent: 'BOOK', ...over });
const decide = (policies, over, g, now = NOW) => resolve(snap(policies, g), ctx(over), now);

// 1. a service without any policy behaves as before: active and bookable where the existing coverage allows it
let d = decide([]);
assert.equal(d.effectiveStatus, 'ACTIVE'); assert(d.canBook && d.isVisible); assert.equal(d.capacityStatus, 'AVAILABLE'); assert.deepEqual(d.reasonCodes, []);

// 2. platform and module policies are enforced and cannot be overridden by a child
for (const status of ['DISABLED', 'MAINTENANCE', 'TEMPORARILY_SUSPENDED']) {
  d = decide([policy('PLATFORM', 'platform', { configuredStatus: status }), policy('SERVICE', 'svc', { configuredStatus: 'ACTIVE', priority: 100 }), policy('OFFER', 'o1', { configuredStatus: 'ACTIVE' })]);
  assert.equal(d.effectiveStatus, status, 'platform ' + status + ' wins over an active service/offer'); assert.equal(d.canBook, false);
}
d = decide([policy('MODULE', 'commerce', { configuredStatus: 'MAINTENANCE', publicMessage: { ar: 'صيانة مجدولة', en: 'Scheduled maintenance' } })]);
assert.equal(d.effectiveStatus, 'MAINTENANCE'); assert.equal(d.canBook, false); assert.deepEqual(d.message, { ar: 'صيانة مجدولة', en: 'Scheduled maintenance' });
d = decide([policy('CATEGORY', 'photo', { configuredStatus: 'DISABLED' }), policy('OFFER', 'o1', { configuredStatus: 'ACTIVE' })]);
assert.equal(d.canBook, false, 'a category-level disable cannot be overridden by a vendor offer'); assert.equal(d.isVisible, false);
d = decide([policy('VENDOR', 'v1', { configuredStatus: 'DISABLED' })], { offerId: 'o2' });
assert.equal(d.canBook, false);
// existing records are part of the hierarchy
d = decide([], { vendorActive: false }); assert.equal(d.canBook, false); assert(d.reasonCodes.includes('VENDOR_INACTIVE')); assert.equal(d.isVisible, false);
d = decide([], { offerEnabled: false }); assert.equal(d.canBook, false); assert(d.reasonCodes.includes('OFFER_DISABLED'));
d = decide([], {}, geo({ services: geo().services.map(s => (s.key === 'feature:commerce' ? { ...s, enabled: false } : s)) })); assert.equal(d.canBook, false); assert(d.reasonCodes.includes('MODULE_DISABLED'));
console.log('Hierarchy, parent prohibitions and existing records: OK');

// 3. each state behaves as specified
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'COMING_SOON', restrictionConfig: { launchDate: '2027-02-01' } })]);
assert.equal(d.effectiveStatus, 'COMING_SOON'); assert.equal(d.canBook, false); assert.equal(d.isVisible, true); assert.equal(d.launchDate, '2027-02-01');
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'صيانة المعدات', suspensionPolicy: { expectedResumeDate: '2026-12-20' } })]);
assert.equal(d.effectiveStatus, 'TEMPORARILY_SUSPENDED'); assert.equal(d.canBook, false); assert.equal(d.expectedResumeDate, '2026-12-20'); assert.equal(d.isVisible, true);
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'DISABLED' })]);
assert.equal(d.canBook, false); assert.equal(d.isVisible, false);
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'DISABLED', visibilityMode: 'VISIBLE' })]);
assert.equal(d.isVisible, true, 'explicit VISIBLE shows a disabled service with its notice'); assert.equal(d.canBook, false);
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'ACTIVE', visibilityMode: 'HIDDEN' })]);
assert.equal(d.isVisible, false); assert.equal(d.canBook, true, 'hidden is independent of bookable');
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'ACTIVE', bookingMode: 'DISABLED' })]);
assert.equal(d.canBook, false); assert.equal(d.isVisible, true); assert.equal(d.effectiveStatus, 'ACTIVE'); assert(d.reasonCodes.includes('BOOKING_DISABLED'));
console.log('States (active, coming soon, suspended, disabled, visibility vs booking): OK');

// 4. partial availability enforces its restrictions
const partial = policy('SERVICE', 'svc', { configuredStatus: 'PARTIALLY_AVAILABLE', restrictionConfig: { cities: ['riyadh'], vendorIds: ['v1'], allowedTimeSlots: ['16:00-20:00'], maxQuantity: 2, maxBookingsPerDay: 5 } });
d = decide([partial]); assert.equal(d.effectiveStatus, 'PARTIALLY_AVAILABLE'); assert(d.canBook); assert.deepEqual(d.restrictions.allowedTimeSlots, ['16:00-20:00']); assert(d.reasonCodes.includes('LIMITED_AVAILABILITY'));
d = decide([partial], { cityId: 'jeddah' }); assert.equal(d.canBook, false); assert(d.reasonCodes.includes('RESTRICTION_CITY'));
d = decide([partial], { vendorId: 'v2' }); assert(d.reasonCodes.includes('RESTRICTION_VENDOR') && !d.canBook);
d = decide([partial], { bookingTime: '10:00' }); assert(d.reasonCodes.includes('RESTRICTION_TIME_SLOT') && !d.canBook);
d = decide([partial], { quantity: 3 }); assert(d.reasonCodes.includes('RESTRICTION_QUANTITY') && !d.canBook);
d = decide([policy('SERVICE', 'svc', { bookingMode: 'CONDITIONAL', restrictionConfig: { offerIds: ['o9'] } })]); assert(d.reasonCodes.includes('RESTRICTION_OFFER') && !d.canBook, 'CONDITIONAL booking mode evaluates restrictions too');
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'PARTIALLY_AVAILABLE', restrictionConfig: { minLeadHours: 24 } })], { bookingDate: '2026-12-02', bookingTime: '10:00' }); assert(d.reasonCodes.includes('RESTRICTION_LEAD_TIME') && !d.canBook);
console.log('Partial availability restrictions: OK');

// 5. geography: precedence, deny over allow, narrowing, and the service location (not the visitor) decides
const rules = [{ countryCode: 'SA', geographicEffect: 'DENY' }, { regionId: 'r-riyadh', geographicEffect: 'ALLOW' }, { cityId: 'riyadh', geographicEffect: 'ALLOW', statusOverride: 'ACTIVE' }];
assert.equal(matchGeoRule(rules, { cityId: 'riyadh', regionId: 'r-riyadh', countryCode: 'SA' }, NOW).cityId, 'riyadh', 'city beats region beats country');
assert.equal(matchGeoRule(rules, { cityId: 'khobar', regionId: 'r-east', countryCode: 'SA' }, NOW).geographicEffect, 'DENY', 'falls back to the country rule');
assert.equal(matchGeoRule([{ cityId: 'riyadh', geographicEffect: 'ALLOW' }, { cityId: 'riyadh', geographicEffect: 'DENY' }], { cityId: 'riyadh' }, NOW).geographicEffect, 'DENY', 'DENY wins at equal precedence');
assert.equal(matchGeoRule([{ cityId: 'riyadh', geographicEffect: 'INHERIT' }, { countryCode: 'SA', geographicEffect: 'DENY' }], { cityId: 'riyadh', countryCode: 'SA' }, NOW).geographicEffect, 'DENY', 'INHERIT defers to the broader rule');
assert.equal(matchGeoRule([{ cityId: 'riyadh', geographicEffect: 'DENY', effectiveUntil: '2026-01-01T00:00:00Z' }], { cityId: 'riyadh' }, NOW), null, 'expired rules do not take part');
const geoPolicy = policy('SERVICE', 'svc', { geoRules: [{ cityId: 'riyadh', geographicEffect: 'ALLOW' }, { cityId: 'dammam', geographicEffect: 'ALLOW', statusOverride: 'COMING_SOON' }, { cityId: 'jeddah', geographicEffect: 'ALLOW', statusOverride: 'PARTIALLY_AVAILABLE', restrictionConfig: { maxBookingsPerDay: 5, allowedTimeSlots: ['16:00-20:00'] } }, { cityId: 'khobar', geographicEffect: 'DENY' }] });
assert.equal(decide([geoPolicy], { cityId: 'riyadh' }).effectiveStatus, 'ACTIVE');
d = decide([geoPolicy], { cityId: 'dammam' }); assert.equal(d.effectiveStatus, 'COMING_SOON'); assert.equal(d.canBook, false);
d = decide([geoPolicy], { cityId: 'jeddah' }); assert.equal(d.effectiveStatus, 'PARTIALLY_AVAILABLE'); assert(d.canBook); assert.equal(d.restrictions.maxBookingsPerDay, 5);
d = decide([geoPolicy], { cityId: 'khobar' }); assert.equal(d.canBook, false); assert(d.reasonCodes.includes('GEO_RULE_DENIED')); assert.equal(d.isVisible, false);
// event city versus visitor city: a visitor in Riyadh can book an event in Jeddah, and a visitor anywhere is blocked for a Khobar event
d = decide([geoPolicy], { cityId: 'jeddah', visitorCityId: 'riyadh' }); assert(d.canBook, 'the event city decides, not where the visitor is');
d = decide([geoPolicy], { cityId: 'khobar', visitorCityId: 'riyadh' }); assert.equal(d.canBook, false);
// the existing city coverage layer (GeoRule) still applies, mapped into the same decision
d = decide([], { cityId: 'dammam' }, geo({ rules: [{ cityId: 'dammam', key: 'category:photo', status: 'SOON', message: 'قريباً في الدمام' }] })); assert.equal(d.effectiveStatus, 'COMING_SOON'); assert.equal(d.canBook, false); assert.equal(d.message.ar, 'قريباً في الدمام'); assert(d.reasonCodes.includes('GEO_COMING_SOON'));
d = decide([], { cityId: 'jeddah', legacyServiceId: 'legacy-1' }, geo({ rules: [{ cityId: 'jeddah', key: 'item:legacy-1', status: 'UNAVAILABLE', reason: 'غير متاحة' }] })); assert.equal(d.canBook, false); assert(d.reasonCodes.includes('GEO_UNAVAILABLE'));
assert(decide([], { cityId: 'riyadh', legacyServiceId: 'legacy-1' }).canBook, 'a legacy item is available in its own city'); assert.equal(decide([], { cityId: 'jeddah', legacyServiceId: 'legacy-1' }).canBook, false, 'and needs a rule elsewhere (existing coverage behaviour)');
d = decide([], { serviceCities: ['riyadh'], cityId: 'jeddah' }); assert(d.reasonCodes.includes('SERVICE_CITY_NOT_COVERED') && !d.canBook);
// missing place is an explicit result, never silent access
d = decide([], { cityId: null }); assert.equal(d.canBook, false); assert(d.needsLocation && d.reasonCodes.includes('LOCATION_REQUIRED'));
d = decide([], { cityId: null, intent: 'VIEW' }); assert(d.needsLocation); assert.equal(d.reasonCodes.includes('LOCATION_REQUIRED'), false, 'browsing never demands a location');
// digital services are national unless a rule says otherwise
const dammamDown = geo({ rules: [{ cityId: 'dammam', key: 'category:photo', status: 'UNAVAILABLE' }] });
d = decide([], { cityId: 'dammam', serviceKind: 'DIGITAL' }, dammamDown); assert(d.canBook, 'a digital service ignores implicit city coverage');
d = decide([], { cityId: null, serviceKind: 'DIGITAL' }); assert(d.canBook && !d.needsLocation);
d = decide([policy('SERVICE', 'svc', { geoRules: [{ cityId: 'dammam', geographicEffect: 'DENY' }] })], { cityId: 'dammam', serviceKind: 'DIGITAL' }); assert.equal(d.canBook, false, 'an explicit geographic rule still applies to a digital service');
d = decide([], { cityId: 'dammam', serviceKind: 'PHYSICAL' }, dammamDown); assert.equal(d.canBook, false, 'physical delivery is judged by the delivery city');
console.log('Geographic precedence, event vs visitor location, digital vs physical: OK');

// 6. capacity is its own dimension: a full service stays ACTIVE
const capped = policy('SERVICE', 'svc', { schedules: [{ kind: 'OPERATING', maxBookings: 3 }] });
d = decide([capped], { usedBookings: 3 }); assert.equal(d.configuredStatus, 'ACTIVE'); assert.equal(d.effectiveStatus, 'ACTIVE'); assert.equal(d.capacityStatus, 'FULL'); assert.equal(d.canBook, false); assert(d.reasonCodes.includes('CAPACITY_REACHED')); assert.equal(d.isVisible, true);
d = decide([capped], { usedBookings: 2 }); assert.equal(d.capacityStatus, 'LIMITED'); assert(d.canBook); assert.equal(d.remainingCapacity, 1);
d = decide([capped], { usedBookings: 0 }); assert.equal(d.capacityStatus, 'AVAILABLE'); assert(d.canBook);
d = decide([capped], { usedBookings: 2, bookingUnits: 2 }); assert.equal(d.capacityStatus, 'FULL', 'the booking units requested count');
d = decide([capped], { usedBookings: 2, quantity: 50 }); assert.equal(d.capacityStatus, 'LIMITED', 'the offer quantity is not a number of bookings');
d = decide([policy('SERVICE', 'svc', { restrictionConfig: { maxBookingsPerDay: 0 }, bookingMode: 'CONDITIONAL' })]); assert.equal(d.capacityStatus, 'UNAVAILABLE'); assert.equal(d.canBook, false);
d = decide([policy('SERVICE', 'svc', { geoRules: [{ cityId: 'riyadh', geographicEffect: 'ALLOW', restrictionConfig: { maxBookingsPerDay: 2 } }], bookingMode: 'CONDITIONAL', restrictionConfig: { maxBookingsPerDay: 9 } })], { usedBookings: 2 }); assert.equal(d.capacityStatus, 'FULL', 'a place-level cap narrows the general one');
console.log('Capacity independent of configured status: OK');

// 7. schedules: operating windows, overnight, closures, holidays, maintenance windows, time zones
const monThu = policy('SERVICE', 'svc', { schedules: [{ kind: 'OPERATING', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, { kind: 'OPERATING', dayOfWeek: 4, startTime: '09:00', endTime: '17:00' }] });
assert.equal(dayOfWeekOf('2026-12-14'), 1);
d = decide([monThu], { bookingDate: '2026-12-14', bookingTime: '10:00' }); assert(d.canBook, 'Monday inside hours');
d = decide([monThu], { bookingDate: '2026-12-14', bookingTime: '18:00' }); assert(!d.canBook && d.reasonCodes.includes('OUTSIDE_OPERATING_HOURS'));
d = decide([monThu], { bookingDate: '2026-12-15', bookingTime: '10:00' }); assert(!d.canBook, 'Tuesday has no window');
const night = { kind: 'OPERATING', startTime: '22:00', endTime: '02:00' };
assert(windowCovers(night, '2026-12-14', '23:30') && windowCovers(night, '2026-12-15', '01:00') && !windowCovers(night, '2026-12-15', '03:00') && !windowCovers(night, '2026-12-14', '21:00'), 'overnight window');
assert.equal(withinOperatingHours([], '2026-12-14', '10:00'), null, 'no windows means no opinion');
d = decide([policy('SERVICE', 'svc', { schedules: [{ kind: 'HOLIDAY', startDate: '2026-12-15', endDate: '2026-12-17' }] })], { bookingDate: '2026-12-16' }); assert(!d.canBook && d.reasonCodes.includes('SCHEDULE_CLOSED'));
d = decide([policy('SERVICE', 'svc', { schedules: [{ kind: 'EXCEPTION', startDate: '2026-12-15', startTime: '12:00', endTime: '14:00' }] })], { bookingDate: '2026-12-15', bookingTime: '13:00' }); assert(!d.canBook);
d = decide([policy('SERVICE', 'svc', { schedules: [{ kind: 'EXCEPTION', startDate: '2026-12-15', startTime: '12:00', endTime: '14:00' }] })], { bookingDate: '2026-12-15', bookingTime: '15:00' }); assert(d.canBook, 'a partial-day closure leaves the rest of the day open');
const window = policy('MODULE', 'commerce', { schedules: [{ kind: 'MAINTENANCE', startDate: '2026-12-01', startTime: '11:00', endDate: '2026-12-01', endTime: '14:00' }] });
d = decide([window]); assert.equal(d.effectiveStatus, 'MAINTENANCE', 'inside the scheduled window (12:00 Riyadh)'); assert(!d.canBook);
d = decide([window], {}, undefined, new Date('2026-12-01T06:00:00Z')); assert.equal(d.effectiveStatus, 'ACTIVE', 'before the window (09:00 Riyadh)');
d = decide([window], {}, undefined, new Date('2026-12-01T12:00:00Z')); assert.equal(d.effectiveStatus, 'ACTIVE', 'after the window (15:00 Riyadh)');
assert.deepEqual(localParts(new Date('2026-12-01T21:30:00Z'), 'Asia/Riyadh'), { date: '2026-12-02', time: '00:30', minutes: 30 }, 'time zone conversion crosses midnight');
function dayOfWeekOf(date) { return require('../src/lib/availability/schedule.ts').dayOfWeek(date); }
console.log('Schedules, closures, overnight windows, maintenance windows, time zones: OK');

// 8. policy windows and scheduled activation
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'DISABLED', effectiveFrom: '2027-01-01T00:00:00Z' })]); assert(d.canBook, 'a future policy is not in force yet');
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'DISABLED', effectiveUntil: '2026-11-01T00:00:00Z' })]); assert(d.canBook, 'an expired policy no longer takes part');
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'DISABLED', effectiveFrom: '2026-11-01T00:00:00Z', effectiveUntil: '2027-01-01T00:00:00Z' })]); assert(!d.canBook);
const launching = policy('SERVICE', 'svc', { configuredStatus: 'COMING_SOON', autoActivate: true, restrictionConfig: { launchDate: '2026-11-30' } });
d = decide([launching], { serviceReady: true }); assert.equal(d.effectiveStatus, 'ACTIVE', 'scheduled activation after the launch date'); assert(d.canBook);
d = decide([launching], { serviceReady: false }); assert.equal(d.effectiveStatus, 'COMING_SOON', 'readiness check holds the launch'); assert(d.reasonCodes.includes('LAUNCH_NOT_READY'));
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'COMING_SOON', autoActivate: true, restrictionConfig: { launchDate: '2026-12-20' } })], { serviceReady: true }); assert.equal(d.effectiveStatus, 'COMING_SOON', 'not before the launch date');
// a newer manual suspension (a separate policy, or the same policy changed) is never reversed by the pending activation
d = decide([launching, policy('PLATFORM', 'platform', { configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'x' })], { serviceReady: true }); assert.equal(d.effectiveStatus, 'TEMPORARILY_SUSPENDED');
d = decide([policy('SERVICE', 'svc', { configuredStatus: 'TEMPORARILY_SUSPENDED', autoActivate: false, reason: 'x', restrictionConfig: { launchDate: '2026-11-30' } })], { serviceReady: true }); assert.equal(d.effectiveStatus, 'TEMPORARILY_SUSPENDED', 'activation only applies to a COMING_SOON policy');
// equal-precedence policies pick deterministically (higher priority, then the later start)
const a = policy('SERVICE', 'svc', { configuredStatus: 'DISABLED', priority: 5, effectiveFrom: '2026-01-01T00:00:00Z' }), b = policy('SERVICE', 'svc', { configuredStatus: 'ACTIVE', priority: 9, effectiveFrom: '2026-02-01T00:00:00Z' });
assert.equal(decide([a, b]).configuredStatus, 'ACTIVE'); assert.equal(decide([b, a]).configuredStatus, 'ACTIVE', 'order of input does not matter');
console.log('Policy windows, scheduled activation, manual overrides, determinism: OK');

// 9. existing bookings under suspension/maintenance
const suspended = policy('SERVICE', 'svc', { configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'x' });
assert(decide([suspended], { intent: 'CONFIRM' }).canBook, 'by default existing bookings continue under suspension');
assert.equal(decide([suspended], { intent: 'BOOK' }).canBook, false);
assert.equal(decide([policy('SERVICE', 'svc', { configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'x', suspensionPolicy: { existingBookings: 'BLOCK' } })], { intent: 'CONFIRM' }).canBook, false, 'BLOCK stops confirmation too');
const reviewOnly = policy('SERVICE', 'svc', { configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'x', suspensionPolicy: { existingBookings: 'REVIEW' } });
assert.equal(decide([reviewOnly], { intent: 'CONFIRM' }).canBook, false); assert(decide([reviewOnly], { intent: 'CONFIRM', actorIsAdmin: true }).canBook, 'REVIEW lets an administrator continue');
const platformMaintenance = policy('PLATFORM', 'platform', { configuredStatus: 'MAINTENANCE' });
assert.equal(decide([platformMaintenance], { intent: 'CONFIRM' }).canBook, false, 'platform maintenance blocks customers');
assert(decide([platformMaintenance], { intent: 'CONFIRM', actorIsAdmin: true }).canBook, 'but administrators keep controlled access');
assert.equal(decide([platformMaintenance], { intent: 'BOOK', actorIsAdmin: true }).canBook, false, 'administrators cannot start NEW bookings through platform maintenance');
assert.equal(decide([policy('PLATFORM', 'platform', { configuredStatus: 'DISABLED' })], { intent: 'CONFIRM' }).canBook, true, 'a disabled platform preserves existing bookings by default');
assert.equal(decide([], { intent: 'CONFIRM', vendorActive: false }).canBook, false, 'a switched-off vendor is not bypassed');
d = decide([policy('SERVICE', 'svc', { geoRules: [{ cityId: 'khobar', geographicEffect: 'DENY' }] })], { intent: 'CONFIRM', cityId: 'khobar' }); assert(d.canBook, 'confirming an existing booking is not re-judged by place');
d = decide([capped], { intent: 'CONFIRM', usedBookings: 3 }); assert(d.canBook, 'confirming an existing booking does not need new capacity');
console.log('Existing bookings under suspension and maintenance: OK');

// 10. packages: required vs optional components and substitutes
const comp = (key, optional, primaryOver, subs = []) => ({ key, optional, primary: ctx({ serviceId: 'svc-' + key, offerId: 'o-' + key, ...primaryOver }), substitutes: subs.map(s => ({ id: s, context: ctx({ serviceId: 'svc-' + s, offerId: 'o-' + s }) })) });
const pkgCtx = ctx({ entityType: 'PACKAGE', packageId: 'pkg1', serviceId: null, offerId: null });
let r = evaluatePackage(snap([policy('SERVICE', 'svc-music', { configuredStatus: 'DISABLED' })]), pkgCtx, [comp('hall', false), comp('music', true)]);
assert(r.bookable, 'an unavailable optional component does not disable the package'); assert.deepEqual(r.omitted, ['music']);
r = evaluatePackage(snap([policy('SERVICE', 'svc-hall', { configuredStatus: 'DISABLED' })]), pkgCtx, [comp('hall', false), comp('music', true)]);
assert.equal(r.bookable, false); assert.deepEqual(r.blocking, ['hall']); assert.equal(r.components[0].state, 'UNAVAILABLE');
r = evaluatePackage(snap([policy('SERVICE', 'svc-hall', { configuredStatus: 'DISABLED' })]), pkgCtx, [comp('hall', false, {}, ['hall2'])]);
assert.equal(r.bookable, false); assert.equal(r.components[0].state, 'NEEDS_SUBSTITUTE'); assert.deepEqual(r.components[0].substituteOptions, ['hall2']);
r = evaluatePackage(snap([policy('SERVICE', 'svc-hall', { configuredStatus: 'DISABLED' })]), pkgCtx, [comp('hall', false, {}, ['hall2'])], { hall: { substituteId: 'hall2' } });
assert(r.bookable); assert.equal(r.components[0].state, 'SUBSTITUTED');
r = evaluatePackage(snap([policy('SERVICE', 'svc-hall', { configuredStatus: 'DISABLED' }), policy('SERVICE', 'svc-hall2', { configuredStatus: 'DISABLED' })]), pkgCtx, [comp('hall', false, {}, ['hall2'])], { hall: { substituteId: 'hall2' } });
assert.equal(r.bookable, false, 'a substitute must itself be bookable');
r = evaluatePackage(snap([policy('PACKAGE', 'pkg1', { configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'x' })]), pkgCtx, [comp('hall', false)]);
assert.equal(r.bookable, false, 'the package policy applies as well'); assert(r.packageDecision.isVisible, 'a suspended package stays visible');
r = evaluatePackage(snap([policy('SERVICE', 'svc-hall', { restrictionConfig: { maxBookingsPerDay: 1 }, bookingMode: 'CONDITIONAL' })]), pkgCtx, [{ ...comp('hall', false), primary: ctx({ serviceId: 'svc-hall', offerId: 'o-hall', usedBookings: 1 }) }]);
assert.equal(r.bookable, false, 'a full required component blocks the package, while its status stays ACTIVE'); assert.equal(r.components[0].decision.effectiveStatus, 'ACTIVE');
console.log('Packages: required/optional components and substitutes: OK');

// 11. state machine and validation
assert(canTransition('ACTIVE', 'DISABLED') && canTransition('DISABLED', 'ACTIVE') && canTransition('COMING_SOON', 'ACTIVE'));
assert(!canTransition('DISABLED', 'TEMPORARILY_SUSPENDED') && !canTransition('COMING_SOON', 'MAINTENANCE'), 'restore or launch first');
for (const from of Object.keys(TRANSITIONS)) assert(canTransition(from, 'ACTIVE'), from + ' can always return to ACTIVE');
const bad = (input, pattern) => assert.throws(() => validatePolicy(input, ['commerce']), e => e instanceof PolicyError && pattern.test(e.message), JSON.stringify(input).slice(0, 80));
bad({ entityType: 'GALAXY', entityId: 'x' }, /نوع الكيان/);
bad({ entityType: 'PLATFORM', entityId: 'other' }, /platform/);
bad({ entityType: 'MODULE', entityId: 'nope' }, /الوحدة/);
bad({ entityType: 'SERVICE', entityId: 's', configuredStatus: 'BROKEN' }, /حالة/);
bad({ entityType: 'SERVICE', entityId: 's', configuredStatus: 'PARTIALLY_AVAILABLE' }, /قيداً/);
bad({ entityType: 'SERVICE', entityId: 's', configuredStatus: 'TEMPORARILY_SUSPENDED' }, /سبب/);
bad({ entityType: 'SERVICE', entityId: 's', configuredStatus: 'COMING_SOON', autoActivate: true }, /تاريخ إطلاق/);
bad({ entityType: 'SERVICE', entityId: 's', autoActivate: true }, /قريباً/);
bad({ entityType: 'SERVICE', entityId: 's', bookingMode: 'CONDITIONAL' }, /قيداً/);
bad({ entityType: 'SERVICE', entityId: 's', priority: 1000 }, /الأولوية/);
bad({ entityType: 'SERVICE', entityId: 's', effectiveFrom: '2026-02-01T00:00:00Z', effectiveUntil: '2026-01-01T00:00:00Z' }, /السريان/);
bad({ entityType: 'SERVICE', entityId: 's', restrictionConfig: { hackerField: 1 } }, /قيد غير معروف/);
bad({ entityType: 'SERVICE', entityId: 's', restrictionConfig: { allowedTimeSlots: ['4pm-8pm'] } }, /فترات/);
bad({ entityType: 'SERVICE', entityId: 's', restrictionConfig: { maxBookingsPerDay: -1 } }, /الحد اليومي/);
bad({ entityType: 'SERVICE', entityId: 's', publicMessage: { ar: 'x'.repeat(301) } }, /أطول/);
bad({ entityType: 'SERVICE', entityId: 's', geoRules: [{ geographicEffect: 'DENY' }] }, /دولة أو منطقة أو مدينة/);
bad({ entityType: 'SERVICE', entityId: 's', geoRules: [{ cityId: 'a', geographicEffect: 'ALLOW' }, { cityId: 'a', geographicEffect: 'DENY' }] }, /مكرر/);
bad({ entityType: 'SERVICE', entityId: 's', schedules: [{ kind: 'OPERATING', startTime: '25:00', endTime: '26:00' }] }, /HH:MM/);
bad({ entityType: 'SERVICE', entityId: 's', schedules: [{ kind: 'HOLIDAY' }] }, /تاريخ/);
bad({ entityType: 'SERVICE', entityId: 's', schedules: [{ kind: 'OPERATING', timezone: 'Mars/Base' }] }, /المنطقة الزمنية/);
const good = validatePolicy({ entityType: 'SERVICE', entityId: 's', configuredStatus: 'PARTIALLY_AVAILABLE', restrictionConfig: { cities: ['riyadh'] }, publicMessage: { ar: 'محدودة', en: 'Limited' }, geoRules: [{ cityId: 'jeddah', geographicEffect: 'DENY' }], schedules: [{ kind: 'OPERATING', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] }, ['commerce']);
assert.equal(good.configuredStatus, 'PARTIALLY_AVAILABLE'); assert.equal(good.schedules[0].timezone, 'Asia/Riyadh'); assert.equal(good.visibilityMode, 'AUTO'); assert.equal(good.bookingMode, 'ENABLED');
console.log('State machine and policy validation: OK');

// 12. the response contract and administrators-only trace
d = decide([partial]);
for (const key of ['configuredStatus', 'effectiveStatus', 'isVisible', 'canBook', 'canCheckout', 'capacityStatus', 'reasonCodes', 'restrictions', 'message']) assert(key in d, key);
assert.equal(typeof d.message.ar, 'string'); assert.equal(typeof d.message.en, 'string'); assert(d.trace.length > 0);
assert(SEVERITY.DISABLED > SEVERITY.MAINTENANCE && SEVERITY.MAINTENANCE > SEVERITY.TEMPORARILY_SUSPENDED && SEVERITY.TEMPORARILY_SUSPENDED > SEVERITY.COMING_SOON && SEVERITY.COMING_SOON > SEVERITY.PARTIALLY_AVAILABLE);
// randomised check: no combination of child policies can make a service bookable when a parent forbids it
const statuses = Object.keys(SEVERITY), levels = ['MODULE', 'CATEGORY', 'SERVICE', 'VENDOR', 'OFFER'], ids = { MODULE: 'commerce', CATEGORY: 'photo', SERVICE: 'svc', VENDOR: 'v1', OFFER: 'o1' };
let seed = 42; const rnd = m => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
for (let i = 0; i < 400; i++) {
  const chosen = levels.map(l => policy(l, ids[l], { configuredStatus: statuses[rnd(statuses.length)], restrictionConfig: { cities: ['riyadh'] } }));
  const decision = decide(chosen);
  const worst = chosen.reduce((m, p) => Math.max(m, SEVERITY[p.configuredStatus]), 0);
  assert(SEVERITY[decision.effectiveStatus] >= worst, 'effective status is never looser than any policy in the chain');
  if (worst >= SEVERITY.COMING_SOON) assert.equal(decision.canBook, false);
}
console.log('Contract, severity ordering and 400 randomised hierarchies: OK');
console.log('\nPASS availability engine unit tests');
