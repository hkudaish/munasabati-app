import { CardDesign, DEFAULT_DESIGN, InviteTemplate, LAYOUTS, OccasionKind, STYLES, AUDIENCES, hijriOf } from './catalog';

export interface Palette { name: string; background: string; foreground: string; accent: string }
export const COLLECTIONS = {
  men: 'زواج الرجال', women: 'زواج النساء', engagement: 'خطوبة وملكة', nikah: 'عقد القران', general: 'زواج عام', digital: 'دعوات رقمية', other: 'مناسبات أخرى',
} as const;
export type CollectionId = keyof typeof COLLECTIONS;
export interface LibraryTemplate extends InviteTemplate {
  nameEn: string; collection: CollectionId; audience: keyof typeof AUDIENCES;
  languages: ('ar' | 'en')[]; rtl: true; kind: 'static'; orientation: 'portrait' | 'square';
  print: true; premium: false; palettes: Palette[];
  /** Fields the card needs before it can be sent. */
  required: (keyof CardDesign)[];
  /** Fictional data shown in thumbnails only; never copied into a customer's card. */
  sample: Partial<CardDesign>;
}

const LIGHT: Palette[] = [
  { name: 'عاجي وذهبي', background: '#fbf8f0', foreground: '#3a3226', accent: '#8f6f2b' },
  { name: 'أخضر زمردي', background: '#eef5f1', foreground: '#1f3d33', accent: '#2f6b56' },
  { name: 'كحلي', background: '#f1f3f8', foreground: '#1c2a45', accent: '#2c4a82' },
  { name: 'وردي', background: '#fcf0f2', foreground: '#5a2c3b', accent: '#a0405a' },
  { name: 'ترابي', background: '#f8eee6', foreground: '#4a2f22', accent: '#9a4a28' },
  { name: 'بنفسجي', background: '#f4f0fa', foreground: '#3b2b57', accent: '#6a49a0' },
];
const DARK: Palette[] = [
  { name: 'ليلي وذهبي', background: '#15130f', foreground: '#f1e8d3', accent: '#d1ab3c' },
  { name: 'زمردي داكن', background: '#0f3a31', foreground: '#f4ead0', accent: '#d6b966' },
  { name: 'كحلي وذهبي', background: '#12294a', foreground: '#eef3fb', accent: '#e1bb55' },
  { name: 'عنابي', background: '#3b1220', foreground: '#fbeaef', accent: '#e5a3b6' },
];
const isDark = (hex: string) => parseInt(hex.slice(1, 3), 16) * .3 + parseInt(hex.slice(3, 5), 16) * .59 + parseInt(hex.slice(5, 7), 16) * .11 < 110;
const alternatives = (main: Palette, index: number): Palette[] => {
  const pool = (isDark(main.background) ? DARK : LIGHT).filter(p => p.background !== main.background);
  return [pool[index % pool.length], pool[(index + 2) % pool.length]];
};

type Row = {
  slug: string; name: string; en: string; collection: CollectionId; occasion: OccasionKind; audience: keyof typeof AUDIENCES; style: keyof typeof STYLES;
  layout: keyof typeof LAYOUTS; motif: CardDesign['motif']; font: CardDesign['font']; main: Palette; titleSize?: number; size?: CardDesign['size'];
  text: Partial<CardDesign>; sample: Partial<CardDesign>;
};
const wed = { opening: 'يتشرف أهل العريس بدعوتكم لحضور حفل الزفاف المبارك', closing: 'حضوركم يسعدنا ويزيد فرحتنا' };
const ladies = { opening: 'يسعدنا دعوتكن لمشاركتنا فرحة ليلة العمر', closing: 'نتشرف بحضوركن ونسعد بتواجدكن' };
const sampleWed = { groom: 'عبدالله', bride: 'نورة', host: 'آل الحربي وآل القحطاني', date: '2027-06-12', hijri: '', time: 'الثامنة والنصف مساءً', venue: 'قاعة الياسمين', address: 'حي الملقا، الرياض', rsvpBy: '2027-06-01', contact: '0500000000', title: 'حفل زفاف' };
const rows: Row[] = [
  { slug: 'royal-black-gold', name: 'ذهب ملكي', en: 'Royal Black & Gold', collection: 'men', occasion: 'wedding', audience: 'men', style: 'luxury', layout: 'royal-frame', motif: 'geometric', font: 'serif', main: DARK[0], titleSize: 48, text: { ...wed, title: 'حفل زفاف' }, sample: sampleWed },
  { slug: 'navy-formal', name: 'كحلي رسمي', en: 'Navy Formal', collection: 'men', occasion: 'wedding', audience: 'men', style: 'modern', layout: 'band-header', motif: 'none', font: 'sans-serif', main: { name: 'كحلي', background: '#f6f3ec', foreground: '#1d2a44', accent: '#1b2f5b' }, titleSize: 40, text: { ...wed, title: 'حفل زفاف' }, sample: sampleWed },
  { slug: 'traditional-arabic', name: 'تراث عربي', en: 'Traditional Arabic', collection: 'men', occasion: 'wedding', audience: 'men', style: 'heritage', layout: 'calligraphy', motif: 'geometric', font: 'serif', main: { name: 'رمل وبني', background: '#f3ead7', foreground: '#3b2f1e', accent: '#7a5a1e' }, titleSize: 52, text: { ...wed, invocation: 'بسم الله الرحمن الرحيم', title: 'دعوة زفاف' }, sample: sampleWed },
  { slug: 'minimal-ivory', name: 'عاجي بسيط', en: 'Minimal Ivory', collection: 'men', occasion: 'wedding', audience: 'men', style: 'minimal', layout: 'info-rows', motif: 'none', font: 'sans-serif', main: { name: 'عاجي', background: '#fbf9f4', foreground: '#2a2a2a', accent: '#8a6f3c' }, titleSize: 44, text: { ...wed, title: 'دعوة زفاف' }, sample: sampleWed },
  { slug: 'rose-garden', name: 'حديقة الورد', en: 'Rose Garden', collection: 'women', occasion: 'wedding', audience: 'women', style: 'floral', layout: 'floral-corners', motif: 'botanical', font: 'serif', main: { name: 'وردي', background: '#fbeff1', foreground: '#5b2a3c', accent: '#a0405a' }, titleSize: 46, text: { ...ladies, title: 'ليلة الزفاف' }, sample: sampleWed },
  { slug: 'pearl-white', name: 'لؤلؤ أبيض', en: 'Pearl White', collection: 'women', occasion: 'wedding', audience: 'women', style: 'minimal', layout: 'monogram-circle', motif: 'none', font: 'serif', main: { name: 'لؤلؤي', background: '#f8f7f5', foreground: '#3c3a42', accent: '#6f6780' }, titleSize: 44, text: { ...ladies, title: 'ليلة الزفاف' }, sample: sampleWed },
  { slug: 'lavender-blossom', name: 'أزهار اللافندر', en: 'Lavender Blossom', collection: 'women', occasion: 'wedding', audience: 'women', style: 'floral', layout: 'arch-window', motif: 'botanical', font: 'serif', main: { name: 'لافندر', background: '#f2edf8', foreground: '#3f2e5c', accent: '#6a49a0' }, titleSize: 42, text: { ...ladies, title: 'ليلة الزفاف' }, sample: sampleWed },
  { slug: 'champagne-gold', name: 'شمبانيا ذهبية', en: 'Champagne Gold', collection: 'women', occasion: 'wedding', audience: 'women', style: 'luxury', layout: 'split-half', motif: 'none', font: 'serif', main: { name: 'شمبانيا', background: '#faf3e6', foreground: '#4a3a22', accent: '#8f6a22' }, titleSize: 38, text: { ...ladies, title: 'ليلة الزفاف' }, sample: sampleWed },
  { slug: 'emerald-elegance', name: 'أناقة زمردية', en: 'Emerald Elegance', collection: 'engagement', occasion: 'engagement', audience: 'general', style: 'luxury', layout: 'star-medallion', motif: 'geometric', font: 'serif', main: DARK[1], titleSize: 44, text: { opening: 'يسرنا دعوتكم لحضور حفل الملكة', closing: 'بحضوركم تكتمل فرحتنا', title: 'حفل ملكة' }, sample: { ...sampleWed, title: 'حفل ملكة' } },
  { slug: 'blush-celebration', name: 'احتفال وردي', en: 'Blush Celebration', collection: 'engagement', occasion: 'engagement', audience: 'women', style: 'floral', layout: 'arch-window', motif: 'botanical', font: 'serif', main: { name: 'وردي هادئ', background: '#fff2ef', foreground: '#6b3a44', accent: '#a8445c' }, titleSize: 42, text: { opening: 'يسعدنا دعوتكن لحضور حفل خطوبتنا', closing: 'بحضوركن تحلو اللحظات', title: 'حفل خطوبة' }, sample: { ...sampleWed, title: 'حفل خطوبة' } },
  { slug: 'classic-beige', name: 'بيج كلاسيكي', en: 'Classic Beige', collection: 'engagement', occasion: 'engagement', audience: 'general', style: 'heritage', layout: 'side-panel', motif: 'none', font: 'serif', main: { name: 'بيج', background: '#f4ecdf', foreground: '#4a3d2c', accent: '#7c5a2a' }, titleSize: 40, text: { opening: 'ندعوكم لمشاركتنا فرحة الخطوبة', closing: 'شرفونا بحضوركم', title: 'حفل خطوبة' }, sample: { ...sampleWed, title: 'حفل خطوبة' } },
  { slug: 'islamic-geometry', name: 'هندسة إسلامية', en: 'Islamic Geometry', collection: 'nikah', occasion: 'nikah', audience: 'general', style: 'heritage', layout: 'star-medallion', motif: 'geometric', font: 'serif', main: DARK[2], titleSize: 46, text: { invocation: 'بسم الله الرحمن الرحيم', opening: 'يتشرف أهل العروسين بدعوتكم لحضور مراسم عقد القران', closing: 'بارك الله لهما وبارك عليهما وجمع بينهما في خير', title: 'عقد قران' }, sample: { ...sampleWed, title: 'عقد قران' } },
  { slug: 'traditional-calligraphy', name: 'خط وتراث', en: 'Traditional Calligraphy', collection: 'nikah', occasion: 'nikah', audience: 'general', style: 'heritage', layout: 'royal-frame', motif: 'geometric', font: 'serif', main: { name: 'عاجي وبني', background: '#f7f1e3', foreground: '#33281a', accent: '#85601a' }, titleSize: 50, text: { invocation: 'بسم الله الرحمن الرحيم', opening: 'يشرفنا دعوتكم لحضور عقد قران ابننا المبارك', closing: 'جمع الله بينهما في خير', title: 'عقد قران' }, sample: { ...sampleWed, title: 'عقد قران' } },
  { slug: 'modern-nikah', name: 'نكاح عصري', en: 'Modern Nikah', collection: 'nikah', occasion: 'nikah', audience: 'general', style: 'modern', layout: 'monogram-circle', motif: 'none', font: 'sans-serif', main: { name: 'أخضر', background: '#eef5f1', foreground: '#1f3d33', accent: '#2a6650' }, titleSize: 42, text: { invocation: 'بسم الله الرحمن الرحيم', opening: 'يسعدنا دعوتكم لحضور عقد القران', closing: 'بارك الله لهما', title: 'عقد قران' }, sample: { ...sampleWed, title: 'عقد قران' } },
  { slug: 'botanical-green', name: 'أخضر نباتي', en: 'Botanical Green', collection: 'general', occasion: 'wedding', audience: 'general', style: 'floral', layout: 'floral-corners', motif: 'botanical', font: 'serif', main: { name: 'أخضر نباتي', background: '#eef3e9', foreground: '#2f4632', accent: '#4f7a45' }, titleSize: 44, text: { opening: 'بكل الحب والسرور ندعوكم لمشاركتنا فرحتنا', closing: 'بحضوركم تكتمل فرحتنا', title: 'حفل زفاف' }, sample: sampleWed },
  { slug: 'modern-monogram', name: 'شعار عصري', en: 'Modern Monogram', collection: 'general', occasion: 'wedding', audience: 'general', style: 'modern', layout: 'monogram-circle', motif: 'none', font: 'sans-serif', main: { name: 'فحمي', background: '#f5f5f3', foreground: '#2b2f33', accent: '#4c5a66' }, titleSize: 42, text: { opening: 'ندعوكم لمشاركتنا أجمل لحظات العمر', closing: 'نتطلع إلى حضوركم', title: 'حفل زفاف' }, sample: sampleWed },
  { slug: 'terracotta-romance', name: 'رومانسية ترابية', en: 'Terracotta Romance', collection: 'general', occasion: 'wedding', audience: 'general', style: 'heritage', layout: 'arch-window', motif: 'arch', font: 'serif', main: { name: 'ترابي', background: '#f8eee6', foreground: '#4a2f22', accent: '#9a4a28' }, titleSize: 44, text: { opening: 'بقلوب مليئة بالحب ندعوكم لحضور زفافنا', closing: 'وجودكم يكمل فرحتنا', title: 'حفل زفاف' }, sample: sampleWed },
  { slug: 'animated-envelope', name: 'المظروف', en: 'Animated Envelope', collection: 'digital', occasion: 'wedding', audience: 'general', style: 'luxury', layout: 'envelope', motif: 'none', font: 'serif', main: { name: 'عاجي', background: '#f3ecdc', foreground: '#3d3322', accent: '#8a6a2c' }, titleSize: 42, text: { opening: 'وصلتكم دعوة خاصة لحضور حفل زفافنا', closing: 'بانتظار تأكيد حضوركم', title: 'دعوة زفاف' }, sample: sampleWed },
  { slug: 'cinematic-wedding', name: 'ليلة سينمائية', en: 'Cinematic Wedding', collection: 'digital', occasion: 'wedding', audience: 'general', style: 'modern', layout: 'band-header', motif: 'none', font: 'sans-serif', main: { name: 'سينمائي', background: '#16161d', foreground: '#f2eee6', accent: '#d9b25f' }, titleSize: 46, text: { opening: 'ليلة واحدة، قصة عمر', closing: 'كونوا جزءاً من القصة', title: 'حفل زفاف' }, sample: sampleWed },
  { slug: 'floral-reveal', name: 'زهور تتفتح', en: 'Floral Reveal', collection: 'digital', occasion: 'wedding', audience: 'general', style: 'floral', layout: 'envelope', motif: 'botanical', font: 'serif', main: { name: 'وردي ترابي', background: '#fbeee9', foreground: '#5a2f33', accent: '#a64a52' }, titleSize: 42, text: { opening: 'تفتحت الأزهار لتزف إليكم الخبر', closing: 'يسعدنا حضوركم', title: 'دعوة زفاف' }, sample: sampleWed },
  { slug: 'graduation', name: 'حفل تخرج', en: 'Graduation', collection: 'other', occasion: 'graduation', audience: 'general', style: 'modern', layout: 'side-panel', motif: 'stars', font: 'sans-serif', main: { name: 'كحلي وذهبي', background: '#12294a', foreground: '#eef3fb', accent: '#e1bb55' }, titleSize: 40, text: { opening: 'بكل فخر ندعوكم لحضور حفل تخرج', closing: 'شاركونا فرحة الإنجاز', title: 'حفل تخرج' }, sample: { title: 'حفل تخرج نورة', host: 'عائلة الشمري', date: '2027-07-03', time: 'السابعة مساءً', venue: 'قاعة الأمير سلطان', address: 'جامعة الأميرة نورة، الرياض', contact: '0500000000' } },
  { slug: 'new-baby', name: 'مولود جديد', en: 'New Baby', collection: 'other', occasion: 'newborn', audience: 'general', style: 'floral', layout: 'ribbon-banner', motif: 'stars', font: 'sans-serif', main: { name: 'أزرق سماوي', background: '#eef6fb', foreground: '#274560', accent: '#3a6f9a' }, titleSize: 36, text: { opening: 'بفرح وامتنان نستقبل مولودنا الجديد', closing: 'ندعوكم لمشاركتنا الفرحة', title: 'مرحباً بالمولود' }, sample: { title: 'مرحباً بالمولود', host: 'عائلة العتيبي', date: '2027-03-18', time: 'الرابعة عصراً', venue: 'استراحة الورود', address: 'حي النرجس، الرياض', contact: '0500000000' } },
  { slug: 'birthday', name: 'عيد ميلاد', en: 'Birthday', collection: 'other', occasion: 'birthday', audience: 'general', style: 'modern', layout: 'ribbon-banner', motif: 'confetti', font: 'sans-serif', main: { name: 'مشمشي', background: '#fff4d9', foreground: '#5a3b2b', accent: '#a64b27' }, titleSize: 36, text: { opening: 'يسعدنا دعوتكم لحضور حفل عيد ميلاد', closing: 'سنكون سعداء بحضوركم', title: 'عيد ميلاد سعيد' }, sample: { title: 'عيد ميلاد سعيد', host: 'سارة', date: '2027-04-09', time: 'السادسة مساءً', venue: 'مقهى الحديقة', address: 'حي الياسمين، جدة', contact: '0500000000' } },
  { slug: 'formal-dinner', name: 'عشاء رسمي', en: 'Formal Dinner', collection: 'other', occasion: 'formal', audience: 'general', style: 'luxury', layout: 'royal-frame', motif: 'none', font: 'serif', main: { name: 'فحمي وفضي', background: '#1c232b', foreground: '#eef2f5', accent: '#b9c8d4' }, titleSize: 40, text: { opening: 'يتشرف مجلس الإدارة بدعوتكم لحضور حفل العشاء السنوي', closing: 'الزي الرسمي', title: 'حفل عشاء رسمي' }, sample: { title: 'حفل العشاء السنوي', host: 'مجلس الإدارة', date: '2027-02-20', time: 'الثامنة مساءً', venue: 'فندق الريتز كارلتون', address: 'الرياض', rsvpBy: '2027-02-10', contact: '0500000000' } },
];

export const LIBRARY_TEMPLATES: LibraryTemplate[] = rows.map((r, i) => {
  const design: CardDesign = { ...DEFAULT_DESIGN, ...r.text, layout: r.layout, motif: r.motif, font: r.font, background: r.main.background, foreground: r.main.foreground, accent: r.main.accent, size: r.size ?? 'portrait', titleSize: r.titleSize ?? 44, align: 'center', imageOpacity: 0 };
  return {
    id: `lib-${r.slug}`, name: r.name, nameEn: r.en, collection: r.collection, occasion: r.occasion, audience: r.audience, style: r.style,
    color: isDark(r.main.background) ? 'داكن' : 'فاتح', design, ownerId: 'system', status: 'published', version: 1, updatedAt: '2026-10-22',
    languages: ['ar', 'en'], rtl: true, kind: 'static', orientation: design.size === 'square' ? 'square' : 'portrait', print: true, premium: false,
    palettes: [r.main, ...alternatives(r.main, i)],
    required: ['title', 'date', 'venue'], sample: r.sample,
  };
});

/** What a thumbnail shows: the template with its fictional sample data. */
export const thumbnailDesign = (t: LibraryTemplate): CardDesign => ({ ...t.design, ...t.sample, hijri: hijriOf(t.sample.date ?? '') });
/** The design a customer starts from: the template wording and look, none of the sample people or places. */
export const startingDesign = (t: LibraryTemplate, event: Partial<CardDesign>): CardDesign => ({ ...t.design, ...event });
export const findLibraryTemplate = (id: string) => LIBRARY_TEMPLATES.find(t => t.id === id);
