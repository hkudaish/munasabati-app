// Isolated integration test: a temporary PostgreSQL schema and a separate Next server.
// It never changes the live application's feature settings or real user accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto'); const { PrismaClient } = require('@prisma/client');
for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z_]+)="?(.*?)"?$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2]; }
const schema='system_admin_test_'+randomBytes(8).toString('hex');
const url=new URL(process.env.DATABASE_URL);url.searchParams.set('schema',schema);
const dist='.next-system-test-'+process.pid;
const testTsconfig='.system-test-tsconfig-'+process.pid+'.json';
fs.writeFileSync(testTsconfig,fs.readFileSync('tsconfig.json'));

const env={...process.env,DATABASE_URL:url.toString(),NEXT_TEST_DIST_DIR:undefined,NEXT_TEST_TSCONFIG:testTsconfig,NODE_ENV:'production',NEXT_PUBLIC_APP_URL:'http://localhost:3101'};
const prisma=new PrismaClient({datasourceUrl:url.toString()});let server,logs='';
const base='http://localhost:3101';
const futureDate=new Date(Date.now()+30*864e5).toISOString().slice(0,10);
async function call(route,method='GET',data,cookie) {
 const r=await fetch(base+route,{method,headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const value=await r.json();return{status:r.status,data:value,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
(async()=>{
 const pushed=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env,encoding:'utf8'});assert.equal(pushed.status,0,pushed.stderr||pushed.stdout);
 await require('./seed-geography.cjs').seedGeography(prisma);
 await prisma.saudiCity.createMany({data:[{id:'riyadh',nameAr:'الرياض',nameEn:'Riyadh',regionAr:'الرياض',countryCode:'SA',isAvailable:true,defaultAvailable:true,aliases:['Ar Riyad']},{id:'jeddah',nameAr:'جدة',nameEn:'Jeddah',regionAr:'مكة المكرمة',countryCode:'SA',isAvailable:true,defaultAvailable:true},{id:'abha',nameAr:'أبها',nameEn:'Abha',regionAr:'عسير',countryCode:'SA',isAvailable:false,defaultAvailable:false}]});
 await prisma.serviceCategory.create({data:{id:'test',nameAr:'اختبار',nameEn:'Test',iconName:'test',descriptionAr:'اختبار',color:'#ffffff'}});
 const password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex'),passwordHash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
 const root=await prisma.user.create({data:{name:'مدير اختبار التغطية',phone:'0500000010',role:'SUPER_ADMIN',passwordHash}});
 const admin=await prisma.user.create({data:{name:'إدارة عادية',phone:'0500000011',role:'ADMIN',passwordHash}});
 const vendor=await prisma.vendor.create({data:{businessName:'مورد اختبار',businessNameEn:'Test',categoryId:'test',cityId:'riyadh',logo:'',bannerImage:'',neighborhood:'',bioAr:'',cancellationPolicyAr:'',contactPhone:'0500000012',whatsappNumber:'0500000012',status:'ACTIVE'}});
 await prisma.serviceItem.create({data:{id:'service-one',vendorId:vendor.id,categoryId:'test',cityId:'riyadh',titleAr:'خدمة اختبار التغطية',descriptionAr:'اختبار',price:1000}});
 const order=await prisma.multiVendorOrder.create({data:{orderNumber:'GEO-EXISTING',customerName:'طلب قائم',customerPhone:'0500000013',eventDate:'2026-12-20',cityId:'riyadh',totalSubtotal:1000,totalTax:150,finalTotal:1150,totalDeposit:345,status:'confirmed'}});
 const occasion=await prisma.occasion.create({data:{userId:root.id,title:'دعوة قائمة',occasionTypeId:'wedding',occasionTypeNameAr:'زواج',cityId:'riyadh',date:'2026-12-20'}});
 const guestCode=randomBytes(32).toString('base64url');await prisma.guest.create({data:{occasionId:occasion.id,name:'ضيف قائم',phone:'0500000014',qrCode:guestCode}});
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>{logs+=d;});server.stderr.on('data',d=>{logs+=d;});
 let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/geo/context')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,logs.slice(-2500));
 const login=async u=>{const r=await call('/api/auth/login','POST',{identifier:u.phone,password});assert.equal(r.status,200);return r;};const a=await login(root),b=await login(admin);
 const change=async payload=>call('/api/system-admin/geography','POST',payload,a.cookie);
 assert.equal((await call('/api/system-admin/geography')).status,401);assert.equal((await call('/api/system-admin/geography','GET',undefined,b.cookie)).status,403);
 let unknown=await call('/api/geo/context');assert.equal(unknown.data.summary,'UNKNOWN');assert.equal(unknown.data.selection.cityId,null);
 const forged=await fetch(base+'/api/geo/context',{headers:{'x-vercel-ip-country':'SA','x-vercel-ip-city':'Riyadh'}});assert.equal((await forged.json()).selection.cityId,null);
 assert.equal((await call('/api/geo/authorize','POST',{key:'feature:commerce'})).status,403);
 const manual=await call('/api/geo/location','POST',{source:'MANUAL',cityId:'riyadh'});assert.equal(manual.status,200);const locationCookie=manual.cookie;
 assert.equal(manual.data.summary,'FULL');assert.equal((await call('/api/geo/context','GET',undefined,locationCookie)).data.selection.source,'MANUAL');
 assert.equal((await call('/api/geo/location','POST',{source:'GPS',consent:false,latitude:24,longitude:46},locationCookie)).status,400);
 assert.equal((await call('/api/geo/location','POST',{source:'GPS',consent:true,latitude:24,longitude:46},locationCookie)).status,503);
 assert.equal((await call('/api/geo/context','GET',undefined,locationCookie)).data.selection.cityId,'riyadh');
 assert.equal((await call('/api/geo/location','POST',{source:'MANUAL',cityId:'not-registered'},locationCookie)).status,400);
 const jeddah=await call('/api/geo/location','POST',{source:'MANUAL',cityId:'jeddah'});assert.equal(jeddah.data.summary,'PARTIAL');
 const inactive=await call('/api/geo/location','POST',{source:'MANUAL',cityId:'abha'});assert.equal(inactive.data.summary,'NONE');
 const categorySnapshot=(await call('/api/system-admin/geography','GET',undefined,a.cookie)).data.snapshot;
 for(const id of ['venues','hospitality','decor','photography','entertainment','lighting','giveaways','cake','invitations','staff','rentals','party_store'])assert(categorySnapshot.services.some(s=>s.key==='category:'+id),'Missing category '+id);
 assert.equal((await change({action:'saveDraft',name:'غير صالح',changes:[{type:'rules',cityIds:['riyadh'],keys:['category:unknown'],status:'UNAVAILABLE'}]})).status,400);
 const categoryChange={type:'rules',cityIds:['riyadh'],keys:['category:test'],status:'UNAVAILABLE',message:'التصنيف غير متاح في الرياض'};
 const categoryDraft=await change({action:'saveDraft',name:'تعطيل تصنيف',changes:[categoryChange,{type:'rules',cityIds:['riyadh'],keys:['item:service-one'],status:'AVAILABLE'}]});assert.equal(categoryDraft.status,200);
 assert.equal((await call('/api/geo/authorize','POST',{key:'item:service-one',cityId:'riyadh'})).status,200);
 assert.equal((await change({action:'publish',id:categoryDraft.data.draft.id,version:categoryDraft.data.draft.version})).status,200);
 assert.equal((await call('/api/geo/authorize','POST',{key:'item:service-one',cityId:'riyadh'})).status,403);
 const categoryOrderBlocked=await call('/api/oms/orders','POST',{idempotencyKey:'geo-category-'+Date.now(),cartGroups:[{vendorId:vendor.id,items:[{serviceId:'service-one',cityId:'riyadh'}]}],customerInfo:{customerName:'Test',customerPhone:'0500000015',cityId:'riyadh',eventDate:futureDate,eventTime:'20:00',venueName:'Test venue'}},a.cookie);assert.equal(categoryOrderBlocked.status,403,JSON.stringify(categoryOrderBlocked.data));
 assert.equal((await prisma.geoRule.findUniqueOrThrow({where:{cityId_categoryId:{cityId:'riyadh',categoryId:'test'}}})).status,'UNAVAILABLE');
 const extra=await prisma.serviceItem.create({data:{id:'service-category-new',vendorId:vendor.id,categoryId:'test',cityId:'riyadh',titleAr:'خدمة جديدة في التصنيف',descriptionAr:'اختبار',price:100}});
 assert.equal((await call('/api/geo/authorize','POST',{key:'item:'+extra.id,cityId:'riyadh'})).status,403);await prisma.serviceItem.delete({where:{id:extra.id}});
 const categoryCopy=await change({action:'saveDraft',name:'نسخ التصنيفات',changes:[{type:'copy',sourceId:'riyadh',targetIds:['jeddah']}]});assert.equal((await change({action:'publish',id:categoryCopy.data.draft.id,version:categoryCopy.data.draft.version})).status,200);
 assert.equal((await prisma.geoRule.findUniqueOrThrow({where:{cityId_categoryId:{cityId:'jeddah',categoryId:'test'}}})).status,'UNAVAILABLE');
 const categoryRestore=await change({action:'saveDraft',name:'إعادة التصنيف',changes:[{...categoryChange,status:'AVAILABLE'}]});assert.equal((await change({action:'publish',id:categoryRestore.data.draft.id,version:categoryRestore.data.draft.version})).status,200);
 assert.equal((await call('/api/geo/authorize','POST',{key:'item:service-one',cityId:'riyadh'})).status,200);
 const rule={type:'rules',cityIds:['riyadh'],keys:['item:service-one'],status:'UNAVAILABLE',message:'غير متاحة في الرياض حالياً',reason:'اختبار'};
 let draft=await change({action:'saveDraft',name:'تجربة الإتاحة',changes:[rule]});assert.equal(draft.status,200);draft=draft.data.draft;
 assert.equal((await call('/api/geo/context','GET',undefined,locationCookie)).data.availability.find(x=>x.key==='item:service-one').available,true);
 const delta=await change({action:'previewChanges',changes:[rule]});assert.equal(delta.data.affectedOrders,1);assert.equal(delta.data.rows.find(x=>x.cityId==='riyadh').status,'PARTIAL');
 const preview=await change({action:'preview',cityId:'riyadh',visitorType:'guest',draftId:draft.id});assert.equal(preview.status,200);const previewId=preview.data.previewId;
 const preferencesBefore=await prisma.geoPreference.count();
 const p=await call(`/api/coverage-preview/${previewId}/geo/context`,'GET',undefined,a.cookie);assert.equal(p.status,200);assert.equal(p.data.availability.find(x=>x.key==='item:service-one').available,false);
 assert.equal((await call(`/api/coverage-preview/${previewId}/auth/session`,'GET',undefined,a.cookie)).data.user,null);
 assert.equal((await call(`/api/coverage-preview/${previewId}/occasions`,'GET',undefined,a.cookie)).data.occasions.length,0);
 assert.equal((await call(`/api/coverage-preview/${previewId}/geo/context`,'GET',undefined,b.cookie)).status,403);
 assert.equal((await call(`/api/coverage-preview/${previewId}/auth/register`,'POST',{userType:'client'},a.cookie)).status,403);
 assert.equal((await call(`/api/coverage-preview/${previewId}/oms/orders`,'POST',{},a.cookie)).status,403);assert.equal(await prisma.geoPreference.count(),preferencesBefore);
 assert.equal((await change({action:'publish',id:draft.id,version:draft.version})).status,200);
 assert.equal((await call('/api/geo/authorize','POST',{key:'item:service-one',cityId:'riyadh'})).status,403);
 const directOrder=await call('/api/oms/orders','POST',{idempotencyKey:'geo-direct-'+Date.now(),cartGroups:[{vendorId:vendor.id,items:[{serviceId:'service-one',cityId:'riyadh'}]}],customerInfo:{customerName:'Test',customerPhone:'0500000015',cityId:'riyadh',eventDate:futureDate,eventTime:'20:00',venueName:'Test venue'}},a.cookie);assert.equal(directOrder.status,403,JSON.stringify(directOrder.data));
 const stop=await change({action:'saveDraft',name:'إيقاف المدينة',changes:[{type:'city',id:'riyadh',enabled:false}]});assert.equal((await change({action:'publish',id:stop.data.draft.id,version:stop.data.draft.version})).status,200);
 assert.equal((await call('/api/geo/context','GET',undefined,locationCookie)).data.summary,'NONE');assert.equal((await prisma.multiVendorOrder.findUniqueOrThrow({where:{id:order.id}})).status,'confirmed');
 assert.equal((await call('/api/invitations/'+guestCode,'POST',{status:'confirmed',companionCount:0})).status,200);
 assert.equal((await call('/api/oms/orders','GET',undefined,a.cookie)).status,200);
 const stale=await change({action:'saveDraft',name:'مسودة متعارضة',changes:[{type:'city',id:'riyadh',enabled:true}]});
 assert.equal((await change({action:'country',code:'AE',nameAr:'الإمارات',nameEn:'United Arab Emirates',version:0})).status,200);
 assert.equal((await change({action:'publish',id:stale.data.draft.id,version:stale.data.draft.version})).status,409);
 assert.equal((await change({action:'rebase',id:stale.data.draft.id,version:stale.data.draft.version})).status,200);
 const fresh=await prisma.geoDraft.findUniqueOrThrow({where:{id:stale.data.draft.id}});assert.equal((await change({action:'publish',id:fresh.id,version:fresh.version})).status,200);
 const row={countryCode:'AE',cityId:'dubai-test',nameAr:'دبي',nameEn:'Dubai',regionId:'AE-DU',regionAr:'دبي',regionEn:'Dubai',externalId:'test:DXB',aliases:'Dubayy'};
 assert.equal((await change({action:'cities',rows:[row]})).status,200);assert.equal((await change({action:'cities',rows:[row]})).status,200);assert.equal(await prisma.saudiCity.count({where:{id:row.cityId}}),1);
 assert.equal((await call('/api/geo/location','POST',{source:'MANUAL',cityId:row.cityId})).data.summary,'NONE');
 assert.equal((await change({action:'cities',rows:[{...row,cityId:'duplicate-name',externalId:''}]})).status,409);
 const count=await prisma.saudiCity.count();assert.equal((await change({action:'cities',rows:[{...row,cityId:'rollback-test',nameAr:'مدينة ثانية',nameEn:'Other',externalId:'test:rollback',aliases:''},{...row,cityId:'bad-country',countryCode:'ZZ'}]})).status,400);assert.equal(await prisma.saudiCity.count(),count);
 const current=(await call('/api/system-admin/geography','GET',undefined,a.cookie)).data;
 const policy={...current.snapshot.policy,analyticsEnabled:true};const analytics=await change({action:'saveDraft',name:'تحليلات اختيارية',changes:[{type:'policy',value:policy}]});assert.equal((await change({action:'publish',id:analytics.data.draft.id,version:analytics.data.draft.version})).status,200);
 await call('/api/geo/events','POST',{},locationCookie);await call('/api/geo/events','POST',{},locationCookie);const metrics=await prisma.geoDailyMetric.findMany({where:{kind:'VISIT',cityKey:'riyadh'}});assert.equal(metrics.length,1);assert.equal(metrics[0].count,1);assert.equal(metrics[0].countryKey,'SA');
 const livePreview=await change({action:'preview',cityId:'riyadh',visitorType:'guest'});
 await require('./test-geo-browser.cjs')(base,a.cookie,livePreview.data.url);
 console.log('PASS integration: real location preferences, untrusted IP/VPN correction, full/partial/inactive states, admin isolation, private drafts, read-only preview, stale publish rejection, CSV-style atomic imports, API booking denial, preserved orders/RSVP, and real aggregate deduplication.');
})().catch(e=>{console.error(e);console.error(logs.slice(-1800));process.exitCode=1;}).finally(async()=>{
 if(server?.pid){if(process.platform==='win32')spawnSync('C:\\Windows\\System32\\taskkill.exe',['/pid',String(server.pid),'/T','/F'],{stdio:'ignore'});else server.kill('SIGTERM');}
 if(/^system_admin_test_[a-f0-9]{16}$/.test(schema))await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
 await prisma.$disconnect();try{fs.rmSync(path.resolve(dist),{recursive:true,force:true});fs.rmSync(testTsconfig,{force:true});}catch{}
});
