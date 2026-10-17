import 'server-only';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { parseSelections } from './catalog';
import { HttpError, integer, text } from './http';
export const newCode = () => randomBytes(32).toString('base64url');
export function occasionDTO(o: any) { return { ...o, cityNameAr: o.city?.nameAr || '', city: undefined, userId: undefined, guests: undefined, orders: undefined, invitationDraft: undefined, }; }
export function guestDTO(g: any) { return { ...g, deliveries: undefined, occasion: undefined }; }
export async function ownOccasion(id: string, userId: string) {
  const occasion = await prisma.occasion.findFirst({ where: { id, userId } });
  if (!occasion) throw new HttpError(404, 'المناسبة غير موجودة');
  return occasion;
}
export function occasionData(d: Record<string, any>, partial = false) {
  const result: Record<string, any> = {};
  for (const [key, max] of Object.entries({ title: 100, occasionTypeId: 80, occasionTypeNameAr: 100, cityId: 80, neighborhood: 160, date: 80, time: 80, venueName: 240, notes: 4000 })) {
    if (!partial || d[key] !== undefined) result[key] = text(d[key], max, ['title', 'cityId', 'date', 'occasionTypeId', 'occasionTypeNameAr'].includes(key));
  }
  for (const [key, values] of Object.entries({ guestsSection: ['men','women','families','all'], venueType: ['hall','home','istiraha','chalet','farm','hotel','undecided'], tier: ['economy','medium','luxury','ultra_luxury'], status: ['planning','confirmed','in_progress','completed'] })) {
    if (d[key] !== undefined) { if (!values.includes(d[key])) throw new HttpError(400, 'خيار المناسبة غير صالح'); result[key] = d[key]; }
  }
  for (const key of ['guestCount','budget','spent','readinessPercentage']) if (d[key] !== undefined) result[key] = integer(d[key], key === 'readinessPercentage' ? 100 : 100000000);
  if (d.isApproximateDate !== undefined) { if (typeof d.isApproximateDate !== 'boolean') throw new HttpError(400, 'قيمة غير صالحة'); result.isApproximateDate = d.isApproximateDate; }
  if (d.serviceSelections !== undefined) result.serviceSelections = parseSelections(d.serviceSelections);
  return result;
}
export function guestData(d: Record<string, any>) {
  const phone = text(d.phone, 20, true); const email = text(d.email, 254).toLowerCase() || null;
  if (!/^\+?\d{9,15}$/.test(phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new HttpError(400, 'رقم الجوال أو البريد غير صالح');
  if (!['men','women','family'].includes(d.category) || !['whatsapp','sms','email','link'].includes(d.invitedVia)) throw new HttpError(400, 'قناة الدعوة أو القسم غير صالح');
  return { name: text(d.name, 120, true), phone, email, category: d.category as string, invitedVia: d.invitedVia as string, familyGroup: text(d.familyGroup, 120), companionCount: integer(d.companionCount, 50), notes: text(d.notes, 2000) };
}
