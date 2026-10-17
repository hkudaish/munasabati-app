ALTER TABLE "GeoRule" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeoRule_categoryId_fkey' AND conrelid = '"GeoRule"'::regclass) THEN
    ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "GeoRule_cityId_categoryId_key" ON "GeoRule"("cityId", "categoryId");
ALTER TABLE "GeoRule" DROP CONSTRAINT IF EXISTS "GeoRule_one_service";
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_one_service" CHECK (num_nonnulls("featureId", "serviceId", "categoryId") = 1);
INSERT INTO "ServiceCategory" ("id","nameAr","nameEn","iconName","descriptionAr","color","itemCount","sortOrder") VALUES
('venues','قاعات ومواقع فاخرة','Venues & Halls','Building2','قاعات أفراح، فنادق، شاليهات، استراحات، مزارع، وأسطح خاصة','#004D3F',0,0),
('hospitality','ضيافة وبوفيهات سعودية','Saudi Hospitality & Catering','Coffee','قهوجية، صبابين، ذبائح، بوفيه مفتوح، حلا قهوة، تمور، فود ترك','#C59B27',0,1),
('decor','كوش وديكور وتنسيق','Kosha, Flowers & Decor','Flower2','كوشات أعراس، تنسيق ورود طبيعية، بالونات، طاولات وممرات مداخل','#E53E3E',0,2),
('photography','تصوير وتوثيق احترافي','Photography & Videography','Camera','مصورات نساء، تصوير رجالي، درون، تعديل فوري، 360 Booth','#3182CE',0,3),
('entertainment','عروض وفنون وترفيه','Entertainment & Ardah','Music','عرضة سعودية، شيلات، دي جي، فرق شعبية، فعاليات أطفال ومسارح','#805AD5',0,4),
('lighting','صوت وإضاءة وشاشات','Sound, Lighting & Screens','Lightbulb','شاشات LED، إضاءات حفلات، ليزر، مكسرات صوت احترافية، مسارح','#DD6B20',0,5),
('giveaways','توزيعات وهدايا ضيوف','Giveaways & Gifts','Gift','توزيعات مخصصة بالاسم، عطور، مباخر، شوكولاتة فاخرة، وتذكارات','#D69E2E',0,6),
('cake','كيك وحلويات مناسبات','Cakes & Sweet Tables','UtensilsCrossed','كيكات تخرج، كيك أعراس، طاولات حلا، كوكيز مخصص، آيسكريم لايف','#ED8936',0,7),
('invitations','بطاقات ودعوات رقمية','Digital Invites & RSVP','MailCheck','دعوات واتساب تفاعلية، باركود QR، مواقع إلكترونية للمناسبة','#319795',0,8),
('staff','كوادر وتنظيم وصبابين','Event Staff & Servers','Users2','مباشرات نساء، صبابين رجال، مشرفات قاعة، حراسات أمنية، فاليه','#4A5568',0,9),
('rentals','تأجير مستلزمات وجلسات','Rentals & Tents','Armchair','طاولات نابليون، كراسي شفافة، خيام، دلال، مباخر عملاقة، مكيفات','#718096',0,10),
('party_store','متجر مستلزمات الحفلات','Party Supplies Store','ShoppingBag','أطباق فاخرة، شموع، لوحات ترحيبية أكريليك، لوازم تزيين فورية','#4C51BF',0,11)
ON CONFLICT ("id") DO NOTHING;
