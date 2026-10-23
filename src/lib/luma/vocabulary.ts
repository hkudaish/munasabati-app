/** What people call things, resolved against the categories and cities that really exist in the application (never a fixed list of ids). */
export interface Named { id: string; nameAr: string; nameEn?: string | null }

interface Group { label: string; words: RegExp; category: RegExp }
const GROUPS: Group[] = [
  { label: 'مصور', words: /مصور|تصوير|فوتوغراف|كاميرا|فيديو/, category: /تصوير|مصور|photo/i },
  { label: 'ضيافة', words: /ضيافة|قهوج|صباب|بوفيه|عشاء|طعام|كاترينج/, category: /ضيافة|hospit|cater/i },
  { label: 'كوشة', words: /كوش|ديكور|ورد|زهور|تنسيق/, category: /كوش|ديكور|decor|kosha|flower/i },
  { label: 'قاعة', words: /قاعة|قاعات|فندق|منتجع|استراح|شاليه/, category: /قاعات|hall|venue/i },
  { label: 'فنان', words: /فنان|فنانة|مطرب|ترفيه|عروض|دي جي|dj|فرقة|عرضة/i, category: /ترفيه|فنون|entertain/i },
  { label: 'زفة', words: /زفة|زفات/, category: /زفات|zaff/i },
  { label: 'كيك وحلويات', words: /كيك|حلى|حلويات|شوكولا/, category: /كيك|حلوى|حلويات|cake|sweet/i },
  { label: 'دعوات', words: /دعوة|دعوات|بطاقات/, category: /دعوات|بطاقات|invit/i },
  { label: 'صوتيات وإضاءة', words: /صوت|إضاءة|اضاءة|شاشات/, category: /صوت|sound/i },
  { label: 'توزيعات', words: /توزيعات|هدايا|عطور|بخور|عود/, category: /توزيعات|هدايا|gift|giveaway/i },
  { label: 'كوادر', words: /مباشرات|عمالة|كوادر|فاليه/, category: /كوادر|staff/i },
  { label: 'تأجير', words: /تأجير|ايجار|إيجار|خيام|طاولات/, category: /تأجير|rental/i },
];
const haystack = (c: Named) => `${c.id} ${c.nameAr} ${c.nameEn ?? ''}`;

/** The category a sentence is about, or null. The category's own name wins; otherwise the everyday word for it. */
export function matchCategory<T extends Named>(text: string, categories: T[]): T | null {
  const direct = categories.find(c => text.includes(c.nameAr));
  if (direct) return direct;
  for (const g of GROUPS) if (g.words.test(text)) { const hit = categories.find(c => g.category.test(haystack(c))); if (hit) return hit; }
  return null;
}
/** The short everyday word for a category, for suggested questions ("أفضل مصور في الرياض"). */
export function categoryNoun(category: Named): string {
  const g = GROUPS.find(x => x.category.test(haystack(category)));
  return g?.label ?? category.nameAr;
}
const cityTokens = (c: Named) => `${c.nameAr} ${c.nameEn ?? ''}`.split(/[\s()،,/]+/).map(t => t.replace(/^و(?=.{3,})/, '')).filter(t => t.length >= 3);
/** The city a sentence mentions ("بجدة", "في الرياض", "Jeddah"), or null. */
export function matchCity<T extends Named>(text: string, cities: T[]): T | null {
  const lower = text.toLowerCase();
  return cities.find(c => cityTokens(c).some(t => lower.includes(t.toLowerCase()))) ?? null;
}
const DAYS: Record<string, number> = { الأحد: 0, الاحد: 0, الاثنين: 1, الإثنين: 1, الثلاثاء: 2, الأربعاء: 3, الاربعاء: 3, الخميس: 4, الجمعة: 5, السبت: 6 };
/** "الجمعة القادمة": the next such day after `from` (ISO date, Riyadh calendar day). */
export function nextWeekday(text: string, from: Date = new Date()): string | undefined {
  const name = Object.keys(DAYS).find(d => text.includes(d));
  if (!name) return undefined;
  const riyadh = new Date(from.getTime() + 3 * 3600000), delta = ((DAYS[name] - riyadh.getUTCDay() + 7) % 7) || 7;
  return new Date(riyadh.getTime() + delta * 86400000).toISOString().slice(0, 10);
}
