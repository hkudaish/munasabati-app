export const OCCASIONS = { wedding: 'زواج', engagement: 'خطوبة وملكة', nikah: 'عقد قران', graduation: 'تخرج', newborn: 'مولود جديد', birthday: 'عيد ميلاد', family: 'لقاء عائلي', formal: 'مناسبة رسمية' } as const;
export const AUDIENCES = { men: 'رجال', women: 'نساء', general: 'عام' } as const;
export const LAYOUTS = { classic: 'كلاسيكي', 'royal-frame': 'إطار ملكي', 'arch-window': 'نافذة قوس', 'band-header': 'شريط علوي', 'monogram-circle': 'شعار دائري', 'side-panel': 'لوحة جانبية', 'floral-corners': 'زوايا زهرية', 'star-medallion': 'ميدالية نجمية', envelope: 'مظروف', 'ribbon-banner': 'شريط احتفالي', calligraphy: 'خط عربي', 'info-rows': 'بيانات مرتبة', 'split-half': 'لوحتان' } as const;
export const STYLES = { luxury: 'فاخر', floral: 'زهري', minimal: 'بسيط', modern: 'عصري', heritage: 'تراثي' } as const;
export const MOTIFS = { arch: 'قوس', botanical: 'أوراق وزهور', stars: 'نجوم', confetti: 'قصاصات احتفالية', geometric: 'هندسي', none: 'بدون زخارف' } as const;
export const SIZES = { portrait: { label: 'رقمية · 1080 × 1350', width: 1080, height: 1350 }, square: { label: 'مربعة · 1080 × 1080', width: 1080, height: 1080 }, story: { label: 'قصة · 1080 × 1920', width: 1080, height: 1920 }, a5: { label: 'طباعة A5 · 148 × 210 مم', width: 1748, height: 2480 } } as const;
export type OccasionKind = keyof typeof OCCASIONS;
export interface CardDesign {
  layout: keyof typeof LAYOUTS; invocation: string; host: string; groom: string; bride: string; hijri: string; address: string; rsvpBy: string; contact: string;
  opening: string; title: string; closing: string; date: string; time: string; venue: string;
  background: string; foreground: string; accent: string; image: string;
  font: 'serif' | 'sans-serif'; motif: keyof typeof MOTIFS; size: keyof typeof SIZES;
  align: 'center' | 'right'; titleSize: number; offset: number; imageOpacity: number;
}
export interface InviteTemplate {
  id: string; name: string; occasion: OccasionKind; style: keyof typeof STYLES;
  color: 'فاتح' | 'داكن' | 'ملون'; audience?: keyof typeof AUDIENCES; design: CardDesign; ownerId: string;
  status: 'private' | 'pending' | 'published' | 'rejected' | 'archived'; version: number;
  updatedAt: string; reviewNote?: string;
}
export const DEFAULT_DESIGN: CardDesign = {
  layout: 'classic', invocation: '', host: '', groom: '', bride: '', hijri: '', address: '', rsvpBy: '', contact: '',
  opening: 'بكل الحب والسرور، ندعوكم لمشاركتنا', title: 'وبحضوركم تكتمل فرحتنا', closing: 'نتطلع إلى لقائكم ومشاركتكم أجمل اللحظات',
  date: '', time: '', venue: '', background: '#fbf5ea', foreground: '#403629', accent: '#a77b38', image: '',
  font: 'serif', motif: 'arch', size: 'portrait', align: 'center', titleSize: 46, offset: 0, imageOpacity: 0.2,
};
const seeds: [string, OccasionKind, keyof typeof STYLES, string, string, string, CardDesign['motif']][] = [
  ['عهد من ذهب', 'wedding', 'luxury', '#fbf5ea', '#403629', '#a77b38', 'arch'],
  ['حديقة الورد', 'wedding', 'floral', '#f8edf0', '#633347', '#9e596e', 'botanical'],
  ['ليلة زمردية', 'wedding', 'heritage', '#103e35', '#fff4df', '#d4b36d', 'geometric'],
  ['وعد وردي', 'engagement', 'floral', '#fff1ef', '#713f4b', '#b46b79', 'botanical'],
  ['لقاء القلوب', 'engagement', 'minimal', '#f7f4ed', '#4b4352', '#917782', 'arch'],
  ['سماء بنفسجية', 'engagement', 'modern', '#33254d', '#f4eafe', '#d7b7ee', 'stars'],
  ['خطوة نحو المستقبل', 'graduation', 'modern', '#142b49', '#f0f6ff', '#e0bb65', 'stars'],
  ['فصل جديد', 'graduation', 'minimal', '#f3f5fa', '#203c5b', '#446e9a', 'geometric'],
  ['فرحة الإنجاز', 'graduation', 'luxury', '#262429', '#fff8ed', '#d5b472', 'arch'],
  ['يوم بألوان الفرح', 'birthday', 'modern', '#fff4d9', '#624333', '#b35734', 'confetti'],
  ['حفلة بين النجوم', 'birthday', 'modern', '#29244c', '#fff1fa', '#e3afce', 'stars'],
  ['أمنية جميلة', 'birthday', 'floral', '#f9ecf6', '#633a60', '#aa599f', 'botanical'],
  ['لمة أهل', 'family', 'heritage', '#eee6d7', '#4a4433', '#867144', 'geometric'],
  ['دفء الدار', 'family', 'floral', '#edf1e8', '#344b37', '#6b855b', 'botanical'],
  ['على مائدة المحبة', 'family', 'minimal', '#fcf3e9', '#683e2b', '#af7048', 'arch'],
  ['دعوة إلى التميز', 'formal', 'luxury', '#172c42', '#edf5ff', '#afc6d8', 'geometric'],
  ['حضور راقٍ', 'formal', 'minimal', '#f4f4f1', '#303c40', '#5b737c', 'none'],
  ['ملتقى المستقبل', 'formal', 'modern', '#e9f2f2', '#284f50', '#4d8282', 'geometric'],
];
export const BUILTIN_TEMPLATES: InviteTemplate[] = seeds.map(([name, occasion, style, background, foreground, accent, motif], i) => ({
  id: `builtin-${i + 1}`, name, occasion, style, color: background.startsWith('#f') || background.startsWith('#e') ? 'فاتح' : 'داكن',
  design: { ...DEFAULT_DESIGN, background, foreground, accent, motif, title: name }, ownerId: 'system', status: 'published', version: 1, updatedAt: '2026-10-12',
}));
export function occasionKind(id: string): OccasionKind {
  if (id === 'engagement' || id === 'melka' || id === 'melkah') return 'engagement';
  if (id === 'corporate_opening' || id === 'national_day') return 'formal';
  if (id === 'henna_night') return 'wedding';
  if (id === 'nikah' || id === 'katb_kitab') return 'nikah';
  if (id === 'newborn') return 'newborn';
  return Object.hasOwn(OCCASIONS, id) ? id as OccasionKind : 'family';
}
export function validateDesign(value: unknown): CardDesign {
  if (!value || typeof value !== 'object') throw new Error('ملف التصميم غير صالح');
  const d = value as Record<string, unknown>;
  const result = { ...DEFAULT_DESIGN };
  for (const key of ['opening', 'title', 'closing', 'date', 'time', 'venue'] as const) {
    if (typeof d[key] !== 'string' || (d[key] as string).length > (key === 'title' ? 100 : 240)) throw new Error('النصوص مفقودة أو تتجاوز الطول المسموح');
    result[key] = d[key] as string;
  }
  for (const key of ['background', 'foreground', 'accent'] as const) {
    if (typeof d[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(d[key] as string)) throw new Error('الألوان غير صالحة');
    result[key] = d[key] as string;
  }
  for (const key of ['invocation', 'host', 'groom', 'bride', 'hijri', 'address', 'rsvpBy', 'contact'] as const) {
    if (d[key] === undefined) continue;
    if (typeof d[key] !== 'string' || (d[key] as string).length > (key === 'invocation' ? 80 : 160)) throw new Error('النصوص مفقودة أو تتجاوز الطول المسموح');
    result[key] = d[key] as string;
  }
  if (d.layout !== undefined) { if (!(typeof d.layout === 'string' && Object.hasOwn(LAYOUTS, d.layout))) throw new Error('تخطيط غير مدعوم'); result.layout = d.layout as CardDesign['layout']; }
  if (d.font !== 'serif' && d.font !== 'sans-serif') throw new Error('خط غير مدعوم');
  if (!(typeof d.motif === 'string' && Object.hasOwn(MOTIFS, d.motif)) || !(typeof d.size === 'string' && Object.hasOwn(SIZES, d.size))) throw new Error('المقاس أو الزخرفة غير مدعوم');
  if (d.align !== 'center' && d.align !== 'right') throw new Error('محاذاة غير صالحة');
  for (const [key, min, max] of [['titleSize', 26, 64], ['offset', -80, 80], ['imageOpacity', 0, 0.6]] as const) {
    if (typeof d[key] !== 'number' || !Number.isFinite(d[key]) || (d[key] as number) < min || (d[key] as number) > max) throw new Error('توزيع العناصر غير صالح');
    result[key] = d[key] as number;
  }
  if (typeof d.image !== 'string' || (d.image !== '' && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.image)) || d.image.length > 1100000) throw new Error('صورة غير صالحة؛ استخدم PNG أو JPEG أو WebP');
  return { ...result, font: d.font, motif: d.motif as CardDesign['motif'], size: d.size as CardDesign['size'], align: d.align, image: d.image };
}
export function validateTemplate(value: unknown): InviteTemplate {
  if (!value || typeof value !== 'object') throw new Error('قالب غير صالح');
  const t = value as InviteTemplate;
  if (typeof t.id !== 'string' || typeof t.ownerId !== 'string' || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 80 || !Object.hasOwn(OCCASIONS, t.occasion) || !Object.hasOwn(STYLES, t.style) || !['فاتح', 'داكن', 'ملون'].includes(t.color) || !['private', 'pending', 'published', 'rejected', 'archived'].includes(t.status) || !Number.isInteger(t.version) || t.version < 1 || typeof t.updatedAt !== 'string') throw new Error('بيانات القالب غير صالحة');
  if (t.audience !== undefined && !(typeof t.audience === 'string' && Object.hasOwn(AUDIENCES, t.audience))) throw new Error('بيانات القالب غير صالحة');
  return { id: t.id, ownerId: t.ownerId, name: t.name, ...(t.audience ? { audience: t.audience } : {}), occasion: t.occasion, style: t.style, color: t.color, status: t.status, version: t.version, updatedAt: t.updatedAt, design: validateDesign(t.design), reviewNote: typeof t.reviewNote === 'string' ? t.reviewNote.slice(0, 240) : undefined };
}
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export interface DateParts { day: string; month: string; year: string }
/** Day / month / year of an ISO date (2027-06-12); null for free text. */
export function dateParts(value: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return { day: String(Number(m[3])), month: MONTHS[Number(m[2]) - 1], year: m[1] };
}
/** Umm al-Qura date in Arabic for an ISO date; empty when it cannot be worked out. */
export function hijriOf(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return '';
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))); } catch { return ''; }
}
