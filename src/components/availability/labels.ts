export const STATUS_AR: Record<string, string> = { ACTIVE: 'متاحة', PARTIALLY_AVAILABLE: 'متاحة بشكل محدود', COMING_SOON: 'قريباً', TEMPORARILY_SUSPENDED: 'موقوفة مؤقتاً', DISABLED: 'معطّلة', MAINTENANCE: 'قيد الصيانة' };
export const STATUS_EN: Record<string, string> = { ACTIVE: 'Available', PARTIALLY_AVAILABLE: 'Limited availability', COMING_SOON: 'Coming soon', TEMPORARILY_SUSPENDED: 'Temporarily suspended', DISABLED: 'Unavailable', MAINTENANCE: 'Under maintenance' };
export const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-300', PARTIALLY_AVAILABLE: 'bg-amber-100 text-amber-900 border-amber-300', COMING_SOON: 'bg-sky-100 text-sky-900 border-sky-300',
  TEMPORARILY_SUSPENDED: 'bg-orange-100 text-orange-900 border-orange-300', DISABLED: 'bg-gray-200 text-gray-800 border-gray-400', MAINTENANCE: 'bg-violet-100 text-violet-900 border-violet-300',
};
export const CAPACITY_AR: Record<string, string> = { AVAILABLE: 'السعة متاحة', LIMITED: 'سعة محدودة', FULL: 'اكتملت السعة', UNAVAILABLE: 'لا سعة متاحة' };
export const ENTITY_AR: Record<string, string> = { PLATFORM: 'المنصة', MODULE: 'وحدة تشغيلية', CATEGORY: 'تصنيف خدمات', SERVICE: 'خدمة', OFFER: 'عرض', VENDOR: 'مورد', PACKAGE: 'باقة' };
export const VISIBILITY_AR: Record<string, string> = { AUTO: 'تلقائي', VISIBLE: 'ظاهر دائماً', HIDDEN: 'مخفي' };
export const BOOKING_AR: Record<string, string> = { ENABLED: 'الحجز مفتوح', CONDITIONAL: 'حجز مشروط', DISABLED: 'الحجز مغلق' };
export const GEO_EFFECT_AR: Record<string, string> = { ALLOW: 'السماح', DENY: 'المنع', INHERIT: 'وراثة' };
export const SCHEDULE_AR: Record<string, string> = { OPERATING: 'ساعات التشغيل', EXCEPTION: 'إغلاق استثنائي', HOLIDAY: 'إجازة', MAINTENANCE: 'صيانة مجدولة' };
export const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const REASON_AR: Record<string, string> = {
  STATUS_ACTIVE: 'متاحة', STATUS_COMING_SOON: 'الخدمة معلنة وسيبدأ الحجز لاحقاً', STATUS_TEMPORARILY_SUSPENDED: 'موقوفة مؤقتاً', STATUS_DISABLED: 'معطّلة', STATUS_MAINTENANCE: 'قيد الصيانة',
  LIMITED_AVAILABILITY: 'متاحة بشروط محددة', CAPACITY_REACHED: 'اكتملت السعة في هذا اليوم', BOOKING_DISABLED: 'الحجز الجديد مغلق', LOCATION_REQUIRED: 'لم تُحدَّد مدينة الفعالية',
  GEO_UNAVAILABLE: 'غير متاحة في المدينة (قاعدة التغطية)', GEO_COMING_SOON: 'قادمة قريباً إلى المدينة (قاعدة التغطية)', GEO_RULE_DENIED: 'ممنوعة في المدينة (قاعدة جغرافية)', SERVICE_CITY_NOT_COVERED: 'المدينة خارج تغطية الخدمة',
  OUTSIDE_OPERATING_HOURS: 'خارج ساعات التشغيل', SCHEDULE_CLOSED: 'يوم إغلاق', RESTRICTION_CITY: 'قيد المدينة', RESTRICTION_VENDOR: 'قيد المورد', RESTRICTION_OFFER: 'قيد العرض', RESTRICTION_TIME_SLOT: 'قيد الفترة الزمنية', RESTRICTION_QUANTITY: 'قيد الكمية', RESTRICTION_LEAD_TIME: 'قيد مهلة الحجز',
  VENDOR_INACTIVE: 'المورد غير نشط', OFFER_DISABLED: 'العرض غير مفعّل', MODULE_DISABLED: 'الوحدة معطلة من إعدادات الميزات', LAUNCH_NOT_READY: 'الإطلاق ينتظر اكتمال التجهيز', REVIEW_REQUIRED: 'يتطلب مراجعة الإدارة',
};
/** One shape for the compact listing decision and the full public decision. */
export interface Shown { status: string; canBook: boolean; capacity: string; message?: { ar: string; en: string }; reasons: string[]; launch?: string; resume?: string }
export function shown(d: any): Shown | null {
  if (!d) return null;
  if ('effectiveStatus' in d) return { status: d.effectiveStatus, canBook: d.canBook, capacity: d.capacityStatus, message: d.message, reasons: d.reasonCodes ?? [], launch: d.launchDate, resume: d.expectedResumeDate };
  return { status: d.s, canBook: d.b, capacity: d.c, message: d.m, reasons: d.r ?? [], launch: d.l, resume: d.e };
}
export const comingSoonLike = (d: Shown | null) => !!d && !d.canBook && (d.status === 'COMING_SOON' || d.reasons.includes('GEO_COMING_SOON') || d.reasons.includes('GEO_UNAVAILABLE') || d.reasons.includes('GEO_RULE_DENIED') || d.reasons.includes('SERVICE_CITY_NOT_COVERED'));
