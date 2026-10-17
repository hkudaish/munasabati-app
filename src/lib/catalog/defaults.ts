// Initial taxonomy only. Artist names do not imply representation or booking availability.
export const CATALOG_CATEGORIES = [
  { id: 'event_setup', nameAr: 'تنظيم وتجهيز المناسبات', nameEn: 'Event Setup', iconName: 'Sparkles', descriptionAr: 'تجهيز الزواج والملكة والتخرج والحفلات الخارجية', color: '#047857', sortOrder: 20 },
  { id: 'hall', nameAr: 'القاعات والمنتجعات والفنادق', nameEn: 'Halls and Resorts', iconName: 'Building2', descriptionAr: 'حجز قاعات الزواج والمناسبات', color: '#004D3F', sortOrder: 21 },
  { id: 'zaffah', nameAr: 'الزفات وهندسة الصوت والإضاءة', nameEn: 'Zaffah and Audio', iconName: 'Music', descriptionAr: 'مكتبات الموردين والزفات الجاهزة والمخصصة', color: '#805AD5', sortOrder: 22 },
];
export const CATALOG_SUBCATEGORIES = [
  { id: 'full-wedding', categoryId: 'event_setup', nameAr: 'تجهيز حفلات الزواج كاملة', kind: 'standard' },
  { id: 'engagement-setup', categoryId: 'event_setup', nameAr: 'تجهيز الملكة وعقد القران', kind: 'standard' },
  { id: 'graduation-setup', categoryId: 'event_setup', nameAr: 'تجهيز حفلات التخرج', kind: 'standard' },
  { id: 'outdoor-events', categoryId: 'event_setup', nameAr: 'حفلات خارجية', kind: 'standard' },
  { id: 'wedding-halls', categoryId: 'hall', nameAr: 'حجز قاعات زواج', kind: 'standard' },
  { id: 'male-singer', categoryId: 'entertainment', nameAr: 'حجز فنان للحفل', kind: 'performer', artistKind: 'male' },
  { id: 'female-singer', categoryId: 'entertainment', nameAr: 'حجز فنانة للحفل', kind: 'performer', artistKind: 'female' },
  { id: 'event-dj', categoryId: 'entertainment', nameAr: 'حجز دي جي للحفل', kind: 'standard' },
  { id: 'sound-engineer', categoryId: 'entertainment', nameAr: 'حجز مهندس صوت للحفل', kind: 'standard' },
  { id: 'zaffah-ready', categoryId: 'zaffah', nameAr: 'زفات جاهزة', kind: 'audio', artistKind: 'any' },
  { id: 'zaffah-custom', categoryId: 'zaffah', nameAr: 'زفة مخصصة بالأسماء', kind: 'audio', artistKind: 'any' },
  { id: 'zaffah-male', categoryId: 'zaffah', nameAr: 'زفتك المفضلة للفنانين', kind: 'audio', artistKind: 'male' },
  { id: 'zaffah-female', categoryId: 'zaffah', nameAr: 'زفتك المفضلة للفنانات', kind: 'audio', artistKind: 'female' },
].map((s, sortOrder) => ({ artistKind: null as string | null, ...s, sortOrder }));
const male = ['محمد عبده','عبدالمجيد عبدالله','ماجد المهندس','راشد الماجد','فؤاد عبدالواحد','عايض','فهد الكبيسي','وليد الشامي','دحوم','برهان','سلطان خليفة','راشد الفارس','جابر الكاسر','إبراهيم الحكمي','علوي الدرب','محمد الناصر'];
const female = ['أصالة','أحلام','أميمة','رولان','زينة عماد','نوال الكويتية'];
export const CATALOG_ARTISTS = [ ...male.map((nameAr,i) => ({id:`artist-m-${i+1}`,nameAr,kind:'male',sortOrder:i})), ...female.map((nameAr,i) => ({id:`artist-f-${i+1}`,nameAr,kind:'female',sortOrder:i})) ];
