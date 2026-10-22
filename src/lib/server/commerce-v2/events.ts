import 'server-only';
import { randomUUID } from 'node:crypto';
import { Tx } from '../booking/repository';
import { HttpError } from '../http';

/** Writes a domain event in the caller's transaction, so it exists if and only if the change it describes was committed. */
export async function emit(tx: Tx, event: { aggregateType: string; aggregateId: string; version?: number; type: string; payload: Record<string, unknown> }) {
  await tx.$executeRaw`INSERT INTO "DomainOutbox" ("id","aggregateType","aggregateId","aggregateVersion","eventType","payload") VALUES (${randomUUID()},${event.aggregateType},${event.aggregateId},${event.version ?? 0},${event.type},${JSON.stringify(event.payload)}::jsonb)`;
}

export interface NotificationSettings {
  enabled: boolean;
  reminders: { enabled: boolean; stagesHours: number[]; finalHours: number | null };
  price: { enabled: boolean; groupWindowMinutes: number; notifyDecreases: boolean };
  channels: { inbox: boolean; email: boolean };
  templates: Record<string, { ar?: { title?: string; body?: string }; en?: { title?: string; body?: string } }>;
}
export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  reminders: { enabled: true, stagesHours: [24, 72], finalHours: null },
  price: { enabled: true, groupWindowMinutes: 15, notifyDecreases: true },
  channels: { inbox: true, email: true },
  templates: {},
};
export async function readSettings(tx: Tx): Promise<{ settings: NotificationSettings; version: number }> {
  const row = (await tx.$queryRaw<any[]>`SELECT "body","version" FROM "CartNotificationSetting" WHERE "id"='default'`)[0];
  const body = row?.body ?? {};
  return {
    version: row?.version ?? 0,
    settings: {
      ...DEFAULT_SETTINGS, ...body,
      reminders: { ...DEFAULT_SETTINGS.reminders, ...(body.reminders ?? {}) },
      price: { ...DEFAULT_SETTINGS.price, ...(body.price ?? {}) },
      channels: { ...DEFAULT_SETTINGS.channels, ...(body.channels ?? {}) },
      templates: body.templates ?? {},
    },
  };
}
const hours = (value: unknown) => { if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 24 * 90) throw new HttpError(400, 'قيمة رقمية غير صالحة'); return value as number; };
/** Validates an administrator's change; anything not understood is rejected rather than stored. */
export function parseSettings(input: any): NotificationSettings {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'بيانات غير صالحة');
  const stages = Array.isArray(input.reminders?.stagesHours) ? input.reminders.stagesHours.map(hours) : DEFAULT_SETTINGS.reminders.stagesHours;
  if (stages.length > 4 || stages.some((h: number, i: number) => i > 0 && h <= stages[i - 1])) throw new HttpError(400, 'قائمة غير صالحة');
  const templates: NotificationSettings['templates'] = {};
  for (const [key, value] of Object.entries(input.templates ?? {})) {
    if (!['cart_reminder', 'price_increase', 'price_decrease', 'item_review'].includes(key) || !value || typeof value !== 'object') throw new HttpError(400, 'بيانات غير صالحة');
    const clean: any = {};
    for (const lang of ['ar', 'en'] as const) {
      const t = (value as any)[lang]; if (!t) continue;
      for (const field of ['title', 'body']) if (t[field] !== undefined && (typeof t[field] !== 'string' || t[field].length > 1000)) throw new HttpError(400, 'قيمة نصية غير صالحة');
      clean[lang] = { ...(t.title ? { title: t.title } : {}), ...(t.body ? { body: t.body } : {}) };
    }
    templates[key] = clean;
  }
  return {
    enabled: input.enabled !== false,
    reminders: { enabled: input.reminders?.enabled !== false, stagesHours: stages, finalHours: input.reminders?.finalHours == null ? null : hours(input.reminders.finalHours) },
    price: { enabled: input.price?.enabled !== false, groupWindowMinutes: Math.min(1440, Math.max(0, Number.isInteger(input.price?.groupWindowMinutes) ? input.price.groupWindowMinutes : 15)), notifyDecreases: input.price?.notifyDecreases !== false },
    channels: { inbox: input.channels?.inbox !== false, email: input.channels?.email !== false },
    templates,
  };
}

type Texts = { title: string; body: string };
const DEFAULT_TEMPLATES: Record<string, { ar: Texts; en: Texts }> = {
  cart_reminder: {
    ar: { title: 'حجزك ما زال بانتظارك!', body: 'لقد احتفظنا بالخدمات التي اخترتها في سلة مشترياتك. يمكنك العودة لإكمال الحجز بسهولة، مع مراعاة الأسعار الحالية ومدى توفر الخدمات.' },
    en: { title: 'Your booking is still waiting for you!', body: 'We kept the services you chose in your cart. You can come back and finish booking easily, subject to current prices and availability.' },
  },
  price_increase: {
    ar: { title: 'ارتفع سعر عنصر في سلتك', body: '{lines}\nيلزم مراجعة السعر الجديد والموافقة عليه قبل إتمام الطلب.' },
    en: { title: 'The price of an item in your cart went up', body: '{lines}\nPlease review and acknowledge the new price before you place the order.' },
  },
  price_decrease: {
    ar: { title: 'انخفض سعر عنصر في سلتك', body: '{lines}\nيمكنك إتمام الطلب بالسعر الحالي.' },
    en: { title: 'The price of an item in your cart went down', body: '{lines}\nYou can place the order at the current price.' },
  },
  item_review: {
    ar: { title: 'عنصر في سلتك يحتاج مراجعة', body: 'لم يعد أحد العناصر المحفوظة متاحاً بالإعدادات الحالية. بقيت اختياراتك محفوظة ويمكنك تعديلها.' },
    en: { title: 'An item in your cart needs your attention', body: 'One of your saved items is no longer available as configured. Your selections are kept and you can edit them.' },
  },
};
export function renderTemplate(settings: NotificationSettings, template: string, locale: 'ar' | 'en', vars: Record<string, string> = {}): Texts {
  const base = DEFAULT_TEMPLATES[template][locale], over = settings.templates[template]?.[locale] ?? {};
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? vars[key] : whole));
  return { title: fill(over.title ?? base.title), body: fill(over.body ?? base.body) };
}
export const money = (halala: number | bigint, locale: 'ar' | 'en') => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ar-SA', { style: 'currency', currency: 'SAR' }).format(Number(halala) / 100);
