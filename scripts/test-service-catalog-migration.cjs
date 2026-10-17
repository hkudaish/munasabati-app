const assert=require('node:assert/strict'),fs=require('node:fs'),{randomBytes}=require('node:crypto'),{spawnSync}=require('node:child_process'),{PrismaClient}=require('@prisma/client');
for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)="?(.*?)"?$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const schema='catalog_migration_test_'+randomBytes(8).toString('hex'),url=new URL(process.env.DATABASE_URL);url.searchParams.set('schema',schema);const db=new PrismaClient({datasourceUrl:url.toString()});
(async()=>{
 const sql=fs.readFileSync('netlify/database/migrations/202610180001_service_catalog.sql','utf8');assert(!/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(sql));
 await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
 await db.$executeRawUnsafe(`CREATE TABLE "ServiceCategory" (id TEXT PRIMARY KEY,"nameAr" TEXT NOT NULL,"nameEn" TEXT NOT NULL,"iconName" TEXT NOT NULL,"descriptionAr" TEXT NOT NULL,color TEXT NOT NULL,"sortOrder" INT NOT NULL DEFAULT 0)`);
 await db.$executeRawUnsafe(`CREATE TABLE "Vendor" (id TEXT PRIMARY KEY,"businessName" TEXT NOT NULL)`);
 await db.$executeRawUnsafe(`CREATE TABLE "ServiceItem" (id TEXT PRIMARY KEY,"titleAr" TEXT NOT NULL)`);
 await db.$executeRawUnsafe(`CREATE TABLE "Occasion" (id TEXT PRIMARY KEY,title TEXT NOT NULL)`);
 await db.$executeRawUnsafe(`INSERT INTO "ServiceCategory" VALUES ('entertainment','ترفيه','Entertainment','Music','ترفيه','#ffffff',1),('zaffah','اسم مخصص سابق','Existing','Music','وصف سابق','#ffffff',2)`);
 await db.$executeRawUnsafe(`INSERT INTO "Vendor" VALUES ('old-vendor','المحل السابق')`);
 await db.$executeRawUnsafe(`INSERT INTO "ServiceItem" VALUES ('old-service','خدمة سابقة')`);
 await db.$executeRawUnsafe(`INSERT INTO "Occasion" VALUES ('old-occasion','مناسبة سابقة')`);
 const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','execute','--file','netlify/database/migrations/202610180001_service_catalog.sql','--schema','prisma/schema.prisma'],{env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
 assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS count FROM "CatalogArtist"`)[0].count,22);
 assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS count FROM "ServiceSubcategory"`)[0].count,13);
 assert.equal((await db.$queryRaw`SELECT "nameAr" FROM "ServiceCategory" WHERE id='zaffah'`)[0].nameAr,'اسم مخصص سابق');
 assert.deepEqual((await db.$queryRaw`SELECT "titleAr","isPublished" FROM "ServiceItem"`)[0],{titleAr:'خدمة سابقة',isPublished:true});
 assert.deepEqual((await db.$queryRaw`SELECT title,"serviceSelections" FROM "Occasion"`)[0],{title:'مناسبة سابقة',serviceSelections:[]});
 console.log('PASS additive catalog migration: 13 subcategories, 22 artists, preserved custom category names, preserved services/occasions, safe existing-row defaults, Netlify transaction ownership.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(/^catalog_migration_test_[a-f0-9]{16}$/.test(schema))await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await db.$disconnect();});
