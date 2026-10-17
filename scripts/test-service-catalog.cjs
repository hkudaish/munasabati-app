const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process'),{randomBytes,createHash}=require('node:crypto'),{PrismaClient}=require('@prisma/client');
for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)="?(.*?)"?$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const schema='catalog_test_'+randomBytes(8).toString('hex'),url=new URL(process.env.DATABASE_URL);url.searchParams.set('schema',schema);
const dist='.next-catalog-test-'+process.pid,config='.catalog-test-tsconfig-'+process.pid+'.json';fs.writeFileSync(config,fs.readFileSync('tsconfig.json'));
const base='http://localhost:3105',env={...process.env,DATABASE_URL:url.toString(),NEXT_TEST_DIST_DIR:dist,NEXT_TEST_TSCONFIG:config,NODE_ENV:'development',NEXT_PUBLIC_APP_URL:base};
const db=new PrismaClient({datasourceUrl:url.toString()});let server,logs='';
async function call(route,method='GET',data,cookie,extra={}){const r=await fetch(base+route,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},body:data?JSON.stringify(data):undefined});return{status:r.status,data:await r.json()};}
(async()=>{
 const pushed=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env,encoding:'utf8'});assert.equal(pushed.status,0,pushed.stdout+pushed.stderr);
 await require('./seed-geography.cjs').seedGeography(db);
 await db.saudiCity.create({data:{id:'riyadh',nameAr:'الرياض',nameEn:'Riyadh',regionAr:'الرياض',countryCode:'SA',isAvailable:true,defaultAvailable:true}});
 const users=[],cookies=[];for(const [i,role]of['CLIENT','CLIENT','VENDOR','VENDOR','SUPER_ADMIN','VENDOR'].entries()){
  const user=await db.user.create({data:{name:'اختبار التصنيفات',phone:'050000010'+i,role}});users.push(user);const token=randomBytes(32).toString('base64url');cookies.push('munasabati_session='+token);
  await db.authSession.create({data:{tokenHash:createHash('sha256').update(token).digest('hex'),userId:user.id,expiresAt:new Date(Date.now()+3600000)}});
 }
 const vendors=[];for(const i of[2,3,5])vendors.push(await db.vendor.create({data:{userId:users[i].id,businessName:'متجر اختبار '+i,businessNameEn:'Test',categoryId:'entertainment',cityId:'riyadh',logo:'',bannerImage:'',neighborhood:'',bioAr:'',cancellationPolicyAr:'',contactPhone:users[i].phone,whatsappNumber:users[i].phone,status:i===5?'UNDER_REVIEW':'ACTIVE'}}));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3105'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health/db')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,logs.slice(-2000));
 const options=await call('/api/catalog/options');assert.equal(options.status,200);assert.equal(options.data.artists.length,22);assert.equal(options.data.subcategories.length,13);
 const artist=options.data.artists.find(a=>a.nameAr==='محمد عبده'),female=options.data.artists.find(a=>a.nameAr==='أصالة');assert(artist&&female);
 assert.equal((await call('/api/vendor/catalog')).status,401);assert.equal((await call('/api/vendor/catalog','GET',undefined,cookies[0])).status,403);
 assert.equal((await call('/api/system-admin/catalog','GET',undefined,cookies[2])).status,403);
 const service={titleAr:'حجز فنان للحفل',descriptionAr:'خدمة اختبار معزولة',categoryId:'entertainment',subcategoryId:'male-singer',artistId:artist.id,cityId:'riyadh',price:1000,priceType:'FIXED',executionDurationHours:3,isPublished:true,rightsConfirmed:true,images:['https://example.invalid/photo.jpg'],videoUrls:['https://example.invalid/video.mp4']};
 assert.equal((await call('/api/vendor/catalog','POST',{...service,rightsConfirmed:false},cookies[2])).status,400);
 assert.equal((await call('/api/vendor/catalog','POST',{...service,subcategoryId:'engagement-setup'},cookies[2])).status,400);
 assert.equal((await call('/api/vendor/catalog','POST',{...service,artistId:female.id},cookies[2])).status,400);
 assert.equal((await call('/api/vendor/catalog','POST',{...service,images:['javascript:alert(1)']},cookies[2])).status,400);
 assert.equal((await call('/api/vendor/catalog','POST',service,cookies[2],{Origin:'https://evil.invalid'})).status,403);
 const created=await call('/api/vendor/catalog','POST',service,cookies[2]);assert.equal(created.status,200,JSON.stringify(created.data));const saved=created.data.service;assert.equal(saved.vendorId,vendors[0].id);
 assert.equal((await call('/api/vendor/catalog','POST',{...service,id:saved.id},cookies[3])).status,404);
 assert.equal((await call('/api/vendor/catalog','POST',{action:'unpublish',id:saved.id},cookies[3])).status,404);
 assert.equal((await call('/api/vendor/catalog','POST',service,cookies[5])).status,403);
 const draft=await call('/api/vendor/catalog','POST',{...service,titleAr:'مسودة خاصة',isPublished:false},cookies[5]);assert.equal(draft.status,200,JSON.stringify(draft.data));
 let catalog=(await call('/api/catalog/services')).data.services;assert(catalog.some(s=>s.id===saved.id&&s.artist.nameAr===artist.nameAr));assert(!catalog.some(s=>s.id===draft.data.service.id));
 const geo=(await call('/api/geo/context')).data;assert(!geo.snapshot.services.some(s=>s.id===draft.data.service.id));
 const media={action:'media',images:['https://example.invalid/store.jpg'],videoUrls:['https://example.invalid/store.mp4'],libraryUrl:'https://example.invalid/library'};
 assert.equal((await call('/api/vendor/catalog','POST',media,cookies[2])).status,200);
 assert.equal((await call('/api/vendor/catalog','POST',{...media,libraryUrl:'http://localhost/secret'},cookies[2])).status,400);
 const pubVendor=(await call('/api/catalog/vendors')).data.vendors.find(v=>v.id===vendors[0].id);assert.equal(pubVendor.videoUrls[0],media.videoUrls[0]);assert.equal(pubVendor.libraryUrl,media.libraryUrl);
 const audio=await call('/api/vendor/catalog','POST',{...service,titleAr:'عينة زفة',categoryId:'zaffah',subcategoryId:'zaffah-male',previewAudioUrl:'https://example.invalid/sample.mp3'},cookies[2]);assert.equal(audio.status,200,JSON.stringify(audio.data));
 const selections=[{categoryId:'entertainment',subcategoryIds:['male-singer'],artistIds:[artist.id]}];
 const future=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 const occasion={title:'اختبار اختيارات المناسبة',occasionTypeId:'wedding',occasionTypeNameAr:'زواج',cityId:'riyadh',date:future,serviceSelections:selections};
 const occ=await call('/api/occasions','POST',occasion,cookies[0]);assert.equal(occ.status,200,JSON.stringify(occ.data));assert.deepEqual(occ.data.occasion.serviceSelections,selections);
 assert.deepEqual((await db.occasion.findUnique({where:{id:occ.data.occasion.id}})).serviceSelections,selections);
 assert.equal((await call('/api/occasions','GET',undefined,cookies[1])).data.occasions.length,0);
 assert.equal((await call('/api/occasions','POST',{...occasion,serviceSelections:[{categoryId:'decor',subcategoryIds:['male-singer'],artistIds:[artist.id]}]},cookies[0])).status,400);
 assert.equal((await call('/api/occasions/'+occ.data.occasion.id,'PATCH',{serviceSelections:[{categoryId:'entertainment',subcategoryIds:['male-singer'],artistIds:[female.id]}]},cookies[0])).status,400);
 const orderInput=()=>({idempotencyKey:randomBytes(24).toString('hex'),items:[{serviceId:saved.id,quantity:1,addons:[]}],customerInfo:{customerName:'عميل اختبار',customerPhone:users[0].phone,cityId:'riyadh',eventDate:future,eventTime:'18:00',venueName:'موقع اختبار',paymentMethod:'mada',occasionId:occ.data.occasion.id}});
 const order=await call('/api/oms/orders','POST',orderInput(),cookies[0]);assert.equal(order.status,200,JSON.stringify(order.data));assert(order.data.masterOrder.suborders[0].items[0].serviceTitleAr.includes(artist.nameAr));assert.equal(order.data.masterOrder.paymentStatus,'UNPAID');
 const incoming=(await call('/api/oms/orders','GET',undefined,cookies[2])).data.orders;assert.equal(incoming.length,1);assert.equal(incoming[0].suborders[0].vendorId,vendors[0].id);
 assert.equal((await call('/api/system-admin/catalog','POST',{...artist,entity:'artist',enabled:false},cookies[4])).status,200);
 assert(!(await call('/api/catalog/services')).data.services.some(s=>s.id===saved.id));
 assert.equal((await call('/api/oms/orders','POST',orderInput(),cookies[0])).status,409);
 assert.equal((await call('/api/system-admin/catalog','POST',{...artist,entity:'artist',enabled:true},cookies[4])).status,200);
 const sub=options.data.subcategories.find(s=>s.id==='male-singer');
 assert.equal((await call('/api/system-admin/catalog','POST',{...sub,entity:'subcategory',isActive:false},cookies[4])).status,200);
 assert(!(await call('/api/catalog/services')).data.services.some(s=>s.id===saved.id));
 assert.equal((await call('/api/system-admin/catalog','POST',{...sub,entity:'subcategory',isActive:true},cookies[4])).status,200);
 assert.equal((await call('/api/vendor/catalog','POST',{action:'unpublish',id:saved.id},cookies[2])).status,200);
 assert(!(await call('/api/catalog/services')).data.services.some(s=>s.id===saved.id));
 assert.equal((await call('/api/oms/orders/'+order.data.masterOrder.id,'GET',undefined,cookies[0])).status,200);
 for(const route of['/artists','/vendor/catalog','/zaffah'])assert.equal((await fetch(base+route)).status,200,route);
 assert(await db.systemAuditLog.count({where:{action:'SERVICE_CREATED'}})>=3);
 if(process.env.RUN_CATALOG_BROWSER==='1'){await db.serviceItem.update({where:{id:saved.id},data:{isPublished:true}});await require('./test-service-catalog-browser.cjs')(base,cookies[0],cookies[2],artist.id,saved.id);}
 console.log('PASS catalog: requested taxonomy, real supplier service creation, ownership, drafts, media/library persistence, artist/subcategory matching, rights confirmation, saved occasion selections, real unpaid artist booking, admin disabling, and preserved history.');
})().catch(e=>{console.error(e);console.error(logs.slice(-4000));process.exitCode=1;}).finally(async()=>{
 if(server?.pid){if(process.platform==='win32')spawnSync('C:\\Windows\\System32\\taskkill.exe',['/pid',String(server.pid),'/T','/F'],{stdio:'ignore'});else server.kill('SIGTERM');}
 if(/^catalog_test_[a-f0-9]{16}$/.test(schema))await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await db.$disconnect();try{fs.rmSync(path.resolve(dist),{recursive:true,force:true});fs.rmSync(config,{force:true})}catch{}
});
