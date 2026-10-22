# الظهور في محركات البحث والنسخة الإنجليزية

## النسخة الإنجليزية
- العربية هي الأصل وعناوينها بلا بادئة. الإنجليزية تحت `/en/...` وتُخدم بإعادة كتابة المسار إلى نفس الصفحات (`src/middleware.ts`)، فلا توجد نسخة ثانية من الكود.
- الصفحات المترجمة فقط (قائمة `TRANSLATED` في `src/lib/i18n/locale.ts`): الرئيسية، السوق، صفحة الخدمة، السلة، الطلبات، الباقات. أي صفحة أخرى تحت `/en` تعود (307) إلى عنوانها العربي، فلا يرى أحد نصاً عربياً داخل تخطيط من اليسار لليمين.
- اللغة تُذكر بملف تعريف الارتباط `locale`، ويبدّل `LanguageSwitcher` (الشريط العلوي والتذييل) بين النسختين. الزواحف لا تحمل الملف فتحصل على كل نسخة من عنوانها.
- **النص العربي هو المفتاح**: `const t = useT(); t('نص عربي', { name })`. القاموس `src/lib/i18n/en/common.ts` يُولَّد من `scripts/en-*.txt` بالأمر `node scripts/build-en-dictionary.cjs` (سطر لكل نص: `عربي => English`). `en-N.txt` لنصوص الواجهة، `en-cN.txt` لمحتوى المنصة (المدن، التصنيفات، الباقات الجاهزة، رسائل الخادم). نص بلا ترجمة يظهر بالعربية ولا ينكسر شيء.
- محتوى المورد: حقول اختيارية `titleEn` `descriptionEn` `nameEn` في نماذج الخدمة والعرض والباقة (`Manage.tsx`)؛ تظهر في النسخة الإنجليزية إن كُتبت، وإلا يظهر النص العربي.
- رسائل الخادم (بالعربية دائماً) تُترجم في العميل عبر `requestJSON` والقاموس.
- التنسيق: `getNumberLocale()` يجعل الأموال والتواريخ `en-US` في الإنجليزية و`ar-SA` في العربية.
- مساعدة «لُـمى» عربية فقط وتُخفى في النسخة الإنجليزية.

### إضافة نص أو صفحة
1. لفّ النص بـ `t()` (أو استعمل `scripts/i18n-codemod.cjs --extract/--apply` على ملف جديد).
2. أضف سطره في `scripts/en-N.txt` ثم `node scripts/build-en-dictionary.cjs`.
3. لصفحة جديدة: أضف نمطها إلى `TRANSLATED`، وعنوانها ووصفها إلى `src/lib/seo/registry.ts`.
4. `npm run test:i18n` يفشل إن وُجد نص مغلّف بلا ترجمة أو اختلفت العناصر النائبة `{name}`.

## ظهور البحث
| ما | أين |
|---|---|
| `robots.txt` (مغلق على أي مضيف غير الرئيسي، ويحجب المناطق الخاصة) | `src/app/robots.ts` |
| `sitemap.xml` (الصفحات + الخدمات الظاهرة فعلاً حسب محرك الإتاحة، مع `hreflang`) | `src/app/sitemap.ts` |
| `manifest.webmanifest` والأيقونات وصور المشاركة | `src/app/manifest.ts`, `public/*.png` |
| العنوان والوصف والـcanonical و`hreflang` وOG/Twitter | `src/lib/seo/metadata.ts` + `registry.ts` |
| بيانات منظمة JSON-LD (منظمة، موقع+بحث، خدمة+عروض+تقييمات، مسار تنقل، قائمة) | `src/components/seo/*`, `src/lib/server/seo/service.ts` |
| `noindex` للمناطق الخاصة (ترويسة `X-Robots-Tag` + `robots`) | `next.config.mjs`, `registry.ts` (`PRIVATE_PREFIXES`) |

- العنوان الرئيسي من `NEXT_PUBLIC_APP_URL` (أو `URL`)، وحالياً `https://munasabit.netlify.app` بلا نطاق مخصص. عند إضافة نطاق: عدّل المتغير فقط؛ الخريطة والـcanonical تتبعه.
- صور المشاركة والأيقونات تُولَّد بـ`node scripts/generate-brand-assets.mjs` (تحتاج `satori` و`@resvg/resvg-js` مثبتين مؤقتاً `--no-save`) ثم تُرفع الملفات الناتجة.
- التحقق بعد النشر (قراءة فقط): `/robots.txt`، `/sitemap.xml`، `/en`، ترويسة `link` و`<link rel=alternate hreflang>`، ومدقّق Rich Results لصفحة خدمة.
