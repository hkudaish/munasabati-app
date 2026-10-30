import type { GeoSnapshot } from '@/lib/geo/types';

/* Availability is several independent dimensions, resolved together by one engine (resolver.ts):
   configured status (what an administrator chose), effective status (after the whole hierarchy and the place),
   public visibility, booking eligibility, operational capacity and geographic coverage. */

export const STATUSES = ['ACTIVE', 'PARTIALLY_AVAILABLE', 'COMING_SOON', 'TEMPORARILY_SUSPENDED', 'DISABLED', 'MAINTENANCE'] as const;
export type Status = typeof STATUSES[number];
export const ENTITY_TYPES = ['PLATFORM', 'MODULE', 'CATEGORY', 'SERVICE', 'OFFER', 'VENDOR', 'PACKAGE'] as const;
export type EntityType = typeof ENTITY_TYPES[number];
export const VISIBILITY = ['VISIBLE', 'HIDDEN', 'AUTO'] as const;
export type Visibility = typeof VISIBILITY[number];
export const BOOKING_MODES = ['ENABLED', 'DISABLED', 'CONDITIONAL'] as const;
export type BookingMode = typeof BOOKING_MODES[number];
export const GEO_EFFECTS = ['ALLOW', 'DENY', 'INHERIT'] as const;
export type GeoEffect = typeof GEO_EFFECTS[number];
export const SCHEDULE_KINDS = ['OPERATING', 'EXCEPTION', 'HOLIDAY', 'MAINTENANCE'] as const;
export type ScheduleKind = typeof SCHEDULE_KINDS[number];
export type CapacityStatus = 'AVAILABLE' | 'LIMITED' | 'FULL' | 'UNAVAILABLE';
export type Intent = 'VIEW' | 'BOOK' | 'CHECKOUT' | 'CONFIRM' | 'MODIFY';
export type LocationRole = 'EVENT' | 'DELIVERY' | 'NONE';

/** What a CONDITIONAL / PARTIALLY_AVAILABLE policy can restrict. */
export interface Restrictions {
  cities?: string[]; vendorIds?: string[]; offerIds?: string[];
  maxBookingsPerDay?: number; allowedTimeSlots?: string[]; maxQuantity?: number; minLeadHours?: number;
  /** COMING_SOON: ISO date (YYYY-MM-DD) of the planned launch */
  launchDate?: string;
}
export interface SuspensionPolicy { existingBookings?: 'CONTINUE' | 'BLOCK' | 'REVIEW'; expectedResumeDate?: string }
export interface PublicMessage { ar?: string; en?: string }
export interface PolicyGeoRule {
  id?: string; countryCode?: string | null; regionId?: string | null; cityId?: string | null;
  geographicEffect: GeoEffect; statusOverride?: Status | null; restrictionConfig?: Restrictions;
  effectiveFrom?: string | null; effectiveUntil?: string | null;
}
export interface PolicySchedule {
  id?: string; kind: ScheduleKind; timezone?: string; startTime?: string | null; endTime?: string | null; dayOfWeek?: number | null;
  startDate?: string | null; endDate?: string | null; maxBookings?: number | null; isEnabled?: boolean;
}
export interface Policy {
  id: string; entityType: EntityType; entityId: string; configuredStatus: Status; visibilityMode: Visibility; bookingMode: BookingMode; priority: number;
  restrictionConfig: Restrictions; suspensionPolicy: SuspensionPolicy; publicMessage: PublicMessage;
  effectiveFrom?: string | null; effectiveUntil?: string | null; autoActivate: boolean; reason?: string | null; version: number; updatedAt?: string;
  geoRules: PolicyGeoRule[]; schedules: PolicySchedule[];
}

/** Everything the resolver reads. Built by the server loader; tests build it by hand. */
export interface Snapshot {
  policies: Policy[];
  geo: GeoSnapshot;
}
export interface Context {
  entityType: 'SERVICE' | 'OFFER' | 'PACKAGE' | 'CATEGORY' | 'MODULE';
  moduleId?: string;                 // feature id that owns the entity, 'commerce' when omitted
  categoryId?: string | null; serviceId?: string | null; legacyServiceId?: string | null; offerId?: string | null; vendorId?: string | null; packageId?: string | null;
  serviceKind?: 'BOOKABLE' | 'FIELD' | 'DIGITAL' | 'PHYSICAL';
  /** the place the service is delivered: the EVENT city for event services, the DELIVERY city for physical goods; never inferred from the visitor */
  cityId?: string | null; countryCode?: string | null; visitorCityId?: string | null;
  bookingDate?: string | null;       // YYYY-MM-DD in the service timezone
  bookingTime?: string | null;       // HH:MM
  quantity?: number; bookingUnits?: number; intent?: Intent; actorIsAdmin?: boolean;
  /** set only for a booking that carries an approved advance-notice exception */
  waiveLeadTime?: boolean;
  /** facts about records that already exist (set by the loader from the existing tables) */
  serviceCities?: string[]; vendorActive?: boolean; offerEnabled?: boolean; serviceReady?: boolean;
  /** bookings already counted for the booking date, for the daily cap */
  usedBookings?: number;
  /** bookings counted for the booking date per hierarchy level (SERVICE, OFFER, VENDOR, CATEGORY, MODULE, PLATFORM, PACKAGE) */
  usedByScope?: Partial<Record<string, number>>;
}
export interface Message { ar: string; en: string }
export interface TraceStep { layer: string; entityId?: string; policyId?: string; status?: Status; note: string }
export interface Decision {
  configuredStatus: Status;
  effectiveStatus: Status;
  isVisible: boolean;
  canBook: boolean;
  canCheckout: boolean;
  capacityStatus: CapacityStatus;
  remainingCapacity: number | null;
  reasonCodes: string[];
  restrictions: Restrictions;
  message: Message;
  needsLocation: boolean;
  launchDate?: string; expectedResumeDate?: string;
  /** administrators only: how the decision was reached */
  trace: TraceStep[];
}
