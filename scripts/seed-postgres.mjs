// Database Seeder for Munasabati PostgreSQL
// Safely populates master categories, Saudi cities, vendors, services, packages, addons, and coupons

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAUDI_CITIES = [
  { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'منطقة الرياض', isAvailable: true, sortOrder: 1 },
  { id: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', regionAr: 'منطقة مكة المكرمة', isAvailable: true, sortOrder: 2 },
  { id: 'dammam', nameAr: 'الدمام والخبر', nameEn: 'Dammam & Khobar', regionAr: 'المنطقة الشرقية', isAvailable: true, sortOrder: 3 },
  { id: 'makkah', nameAr: 'مكة المكرمة', nameEn: 'Makkah', regionAr: 'منطقة مكة المكرمة', isAvailable: true, sortOrder: 4 },
  { id: 'madinah', nameAr: 'المدينة المنورة', nameEn: 'Madinah', regionAr: 'منطقة المدينة المنورة', isAvailable: true, sortOrder: 5 },
  { id: 'taif', nameAr: 'الطائف', nameEn: 'Taif', regionAr: 'منطقة مكة المكرمة', isAvailable: true, sortOrder: 6 },
  { id: 'qassim', nameAr: 'القصيم (بريدة وعنيزة)', nameEn: 'Qassim', regionAr: 'منطقة القصيم', isAvailable: true, sortOrder: 7 },
  { id: 'abha', nameAr: 'أبها وخميس مشيط', nameEn: 'Abha & Khamis', regionAr: 'منطقة عسير', isAvailable: true, sortOrder: 8 },
];

const SERVICE_CATEGORIES = [
  { id: 'photography', nameAr: 'التصوير وتوثيق المناسبة', nameEn: 'Photography & Videography', iconName: 'Camera', descriptionAr: 'توثيق سينمائي فاخر وعدسات احترافية وألبومات ملكية', color: 'emerald', itemCount: 12, sortOrder: 1 },
  { id: 'hospitality', nameAr: 'الضيافة السعودية والبوفيه', nameEn: 'Saudi Hospitality & Catering', iconName: 'Coffee', descriptionAr: 'صبابين، قهوة مختصة، تمر سكري، بوفيهات عشاء مفتوحة', color: 'amber', itemCount: 18, sortOrder: 2 },
  { id: 'decor', nameAr: 'الكوشة والديكور وتنسيق الورد', nameEn: 'Kosha, Flowers & Decor', iconName: 'Sparkles', descriptionAr: 'تصميم كوشات ملكية، طاولات استقبال، وتنسيقات طبيعية', color: 'gold', itemCount: 14, sortOrder: 3 },
  { id: 'hall', nameAr: 'القاعات والمنتجعات والفنادق', nameEn: 'Venues, Halls & Resorts', iconName: 'Home', descriptionAr: 'قاعات أعراس فندقية فاخرة واستراحات ومخيمات VIP', color: 'purple', itemCount: 9, sortOrder: 4 },
  { id: 'zaffah', nameAr: 'الزفات وهندسة الصوت والإضاءة', nameEn: 'Zaffah & Audio Production', iconName: 'Music', descriptionAr: 'زفات حصرية بأسماء العرسان، شاشات LED وهندسة صوتية', color: 'rose', itemCount: 11, sortOrder: 5 },
  { id: 'sweets', nameAr: 'الحلى وتوزيعات المناسبات', nameEn: 'Sweets, Cakes & Favors', iconName: 'Gift', descriptionAr: 'كيك طبقات ملكي، شوكولاتة بلجيكية فاخرة وتوزيعات مميزة', color: 'blue', itemCount: 15, sortOrder: 6 },
];

const COUPONS = [
  {
    code: 'MUNASABATI10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 1000,
    maxDiscountAmount: 500,
    descriptionAr: 'خصم 10% لكافة خدمات السوق بمناسبة تدشين المنصة',
    expiryDate: '2026-12-31',
  },
  {
    code: 'WELCOME500',
    discountType: 'fixed',
    discountValue: 500,
    minOrderAmount: 3500,
    descriptionAr: 'خصم ترحيبي بقيمة 500 ر.س على الحجوزات الكبرى',
    expiryDate: '2026-12-31',
  },
  {
    code: 'VIP20',
    discountType: 'percentage',
    discountValue: 20,
    minOrderAmount: 8000,
    maxDiscountAmount: 2000,
    descriptionAr: 'خصم خاص للمناسبات الملكية الكبرى 20%',
    expiryDate: '2026-12-31',
  },
];

async function main() {
  console.log('🚀 Starting Munasabati PostgreSQL Seeding...');

  // 1. Seed Cities
  for (const city of SAUDI_CITIES) {
    await prisma.saudiCity.upsert({
      where: { id: city.id },
      update: city,
      create: city,
    });
  }
  console.log(`✅ Seeded ${SAUDI_CITIES.length} Saudi Cities.`);

  // 2. Seed Categories
  for (const cat of SERVICE_CATEGORIES) {
    await prisma.serviceCategory.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }
  console.log(`✅ Seeded ${SERVICE_CATEGORIES.length} Service Categories.`);

  // 3. Seed Coupons
  for (const c of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }
  console.log(`✅ Seeded ${COUPONS.length} Promo Coupons.`);

  // 4. Sample Verified Vendor
  const sampleVendor = await prisma.vendor.upsert({
    where: { id: 'vendor-1' },
    update: {},
    create: {
      id: 'vendor-1',
      businessName: 'عدسة الفخامة للإنتاج والتصوير السينمائي',
      businessNameEn: 'Luxury Lens Studio',
      categoryId: 'photography',
      cityId: 'riyadh',
      neighborhood: 'حطين',
      logo: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=200&auto=format&fit=crop&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=80',
      rating: 4.95,
      reviewsCount: 84,
      completedBookingsCount: 142,
      verified: true,
      crNumber: '1010892341',
      vatNumber: '300982341200003',
      serviceAreas: ['الرياض', 'الدرعية', 'الخرج'],
      startingPrice: 2800,
      instantBooking: true,
      responseTimeMinutes: 12,
      badges: ['موثق رسمياً', 'سوبر مورد', 'الأعلى تقييماً'],
      bioAr: 'فريق سعودي محترف متخصص في التغطيات السينمائية الفاخرة لحفلات الزفاف والمناسبات الملكية والملتقيات في الرياض.',
      portfolio: [
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=600&auto=format&fit=crop&q=80',
      ],
      contactPhone: '+966501234567',
      whatsappNumber: '+966501234567',
      cancellationPolicyAr: 'استرجاع كامل للعربون قبل 14 يوماً من موعد الحفل.',
      status: 'ACTIVE',
      featured: true,
      specialtiesAr: ['أعراس ملكية', 'تصوير درون 4K', 'فيديو سينمائي تشويقي'],
    },
  });

  // Seed Vendor Metrics
  await prisma.vendorMetrics.upsert({
    where: { vendorId: sampleVendor.id },
    update: {},
    create: {
      vendorId: sampleVendor.id,
      averageRating: 4.95,
      reviewsCount: 84,
      completedOrders: 142,
      cancelledOrders: 1,
      repeatCustomerRate: 38,
      responseTimeMinutes: 12,
      acceptanceRate: 99,
      onTimeRate: 100,
      satisfactionRate: 98,
      yearsOfExperience: 7,
    },
  });

  // Seed Sample Service
  const sampleService = await prisma.serviceItem.upsert({
    where: { id: 'srv-1' },
    update: {},
    create: {
      id: 'srv-1',
      vendorId: sampleVendor.id,
      categoryId: 'photography',
      cityId: 'riyadh',
      titleAr: 'تغطية فوتوغرافية وسينمائية متكاملة لليلة العمر',
      descriptionAr: 'باقة تصوير شاملة بأحدث كاميرات السينما Sony FX3 وعدسات G-Master مع طاقم نسائي ورجالي محترف وألبوم إيطالي فاخر.',
      price: 3200,
      priceType: 'FIXED',
      images: [
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800&auto=format&fit=crop&q=80',
      ],
      featuresAr: [
        'فريق تصوير محترف (مصورة فوتوغراف + مصور سينمائي)',
        'فيديو سينمائي تيزر تشويقي خلال 48 ساعة للمشاركة',
        'ألبوم إيطالي جلدي فاخر مقاس 30×40 سم مع شنطة جلدية',
        'تسليم جميع الصور الخام المعدلة بدقة فائقة على USB كريستال',
      ],
      instantBooking: true,
      badge: 'الأكثر طلباً',
      isPopular: true,
      executionDurationHours: 6,
    },
  });

  // Seed Service Packages
  await prisma.servicePackage.createMany({
    data: [
      {
        id: 'srv-1-pkg-basic',
        serviceId: sampleService.id,
        nameAr: 'الباقة الكلاسيكية',
        tier: 'BASIC',
        price: 2500,
        descriptionAr: 'تغطية فوتوغرافية أساسية مناسبة للملكات والحفلات العائلية المختصرة',
        durationHours: 4,
        featuresAr: ['مصورة واحدة', 'تعديل 80 صورة', 'تسليم رقمي سريع'],
      },
      {
        id: 'srv-1-pkg-standard',
        serviceId: sampleService.id,
        nameAr: 'الباقة السينمائية المتكاملة',
        tier: 'STANDARD',
        price: 3200,
        descriptionAr: 'تغطية شاملة فيديو وفوتوغراف مع ألبوم ملكي وفيديو تيزر',
        durationHours: 6,
        featuresAr: ['مصورتين (فوتو وفيديو)', 'ألبوم إيطالي ملكي', 'فيديو تيزر 60 ثانية'],
        isPopular: true,
      },
      {
        id: 'srv-1-pkg-vip',
        serviceId: sampleService.id,
        nameAr: 'الباقة الملكية VIP',
        tier: 'VIP',
        price: 4800,
        descriptionAr: 'تغطية استثنائية مع كاميرا درون وبث مباشر وشاشات عرض فورية',
        durationHours: 8,
        featuresAr: ['طاقم 4 مصورين', 'ألبومين ملكيين كبيرين', 'تغطية درون', 'شاشة عرض فورية بالصالة'],
      },
    ],
    skipDuplicates: true,
  });

  // Seed Service Addons
  await prisma.serviceAddon.createMany({
    data: [
      {
        id: 'srv-1-add-1',
        serviceId: sampleService.id,
        titleAr: 'ساعة تصوير إضافية في الموقع',
        price: 400,
        pricingType: 'PER_HOUR',
        isAvailable: true,
      },
      {
        id: 'srv-1-add-2',
        serviceId: sampleService.id,
        titleAr: 'ألبوم إضافي لأم العروس أو أم العريس',
        price: 600,
        pricingType: 'FIXED',
        isAvailable: true,
      },
      {
        id: 'srv-1-add-3',
        serviceId: sampleService.id,
        titleAr: 'تسليم فيديو خلال 24 ساعة Express Delivery',
        price: 500,
        pricingType: 'FIXED',
        isAvailable: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Seeded Sample Vendor, Services, Packages, and Addons.`);
  console.log('🎉 Munasabati PostgreSQL Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
