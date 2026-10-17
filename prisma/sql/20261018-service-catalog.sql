BEGIN;
-- AlterTable
ALTER TABLE "Occasion" ADD COLUMN     "serviceSelections" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ServiceItem" ADD COLUMN     "artistId" TEXT,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "previewAudioUrl" TEXT,
ADD COLUMN     "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subcategoryId" TEXT,
ADD COLUMN     "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "libraryUrl" TEXT,
ADD COLUMN     "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ServiceSubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'standard',
    "artistKind" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogArtist" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogArtist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceSubcategory_categoryId_isActive_idx" ON "ServiceSubcategory"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceItem_subcategoryId_artistId_idx" ON "ServiceItem"("subcategoryId", "artistId");

-- AddForeignKey
ALTER TABLE "ServiceSubcategory" ADD CONSTRAINT "ServiceSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "ServiceSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "CatalogArtist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed taxonomy only; never fabricate artists as bookable vendors.

INSERT INTO "ServiceCategory" ("id","nameAr","nameEn","iconName","descriptionAr","color","sortOrder") VALUES
('event_setup','تنظيم وتجهيز المناسبات','Event Setup','Sparkles','تجهيز الزواج والملكة والتخرج والحفلات الخارجية','#047857',20),
('hall','القاعات والمنتجعات والفنادق','Halls and Resorts','Building2','حجز قاعات الزواج والمناسبات','#004D3F',21),
('zaffah','الزفات وهندسة الصوت والإضاءة','Zaffah and Audio','Music','مكتبات الموردين والزفات الجاهزة والمخصصة','#805AD5',22)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ServiceSubcategory" ("id","categoryId","nameAr","kind","artistKind","sortOrder") VALUES
('full-wedding','event_setup','تجهيز حفلات الزواج كاملة','standard',NULL,0),
('engagement-setup','event_setup','تجهيز الملكة وعقد القران','standard',NULL,1),
('graduation-setup','event_setup','تجهيز حفلات التخرج','standard',NULL,2),
('outdoor-events','event_setup','حفلات خارجية','standard',NULL,3),
('wedding-halls','hall','حجز قاعات زواج','standard',NULL,4),
('male-singer','entertainment','حجز فنان للحفل','performer','male',5),
('female-singer','entertainment','حجز فنانة للحفل','performer','female',6),
('event-dj','entertainment','حجز دي جي للحفل','standard',NULL,7),
('sound-engineer','entertainment','حجز مهندس صوت للحفل','standard',NULL,8),
('zaffah-ready','zaffah','زفات جاهزة','audio','any',9),
('zaffah-custom','zaffah','زفة مخصصة بالأسماء','audio','any',10),
('zaffah-male','zaffah','زفتك المفضلة للفنانين','audio','male',11),
('zaffah-female','zaffah','زفتك المفضلة للفنانات','audio','female',12)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CatalogArtist" ("id","nameAr","kind","sortOrder") VALUES
('artist-m-1','محمد عبده','male',0),
('artist-m-2','عبدالمجيد عبدالله','male',1),
('artist-m-3','ماجد المهندس','male',2),
('artist-m-4','راشد الماجد','male',3),
('artist-m-5','فؤاد عبدالواحد','male',4),
('artist-m-6','عايض','male',5),
('artist-m-7','فهد الكبيسي','male',6),
('artist-m-8','وليد الشامي','male',7),
('artist-m-9','دحوم','male',8),
('artist-m-10','برهان','male',9),
('artist-m-11','سلطان خليفة','male',10),
('artist-m-12','راشد الفارس','male',11),
('artist-m-13','جابر الكاسر','male',12),
('artist-m-14','إبراهيم الحكمي','male',13),
('artist-m-15','علوي الدرب','male',14),
('artist-m-16','محمد الناصر','male',15),
('artist-f-1','أصالة','female',0),
('artist-f-2','أحلام','female',1),
('artist-f-3','أميمة','female',2),
('artist-f-4','رولان','female',3),
('artist-f-5','زينة عماد','female',4),
('artist-f-6','نوال الكويتية','female',5)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
