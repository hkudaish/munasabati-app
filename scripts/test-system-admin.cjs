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

const env={...process.env,DATABASE_URL:url.toString(),NEXT_TEST_DIST_DIR:dist,NEXT_TEST_TSCONFIG:testTsconfig,NODE_ENV:'development',NEXT_PUBLIC_APP_URL:'http://localhost:3101'};
const prisma=new PrismaClient({datasourceUrl:url.toString()});let server,logs='';
const base='http://localhost:3101';
async function call(route,method='GET',data,cookie) {
 const r=await fetch(base+route,{method,headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const value=await r.json();return{status:r.status,data:value,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
(async()=>{
 const pushed=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env,encoding:'utf8'});assert.equal(pushed.status,0,pushed.stderr||pushed.stdout);
 await prisma.saudiCity.create({data:{id:'riyadh',nameAr:'الرياض',nameEn:'Riyadh',regionAr:'الرياض'}});
 await require('./seed-geography.cjs').seedGeography(prisma);
 await prisma.serviceCategory.create({data:{id:'test',nameAr:'اختبار',nameEn:'Test',iconName:'test',descriptionAr:'اختبار',color:'#ffffff'}});
 const password=randomBytes(24).toString('hex'); const salt=randomBytes(16).toString('hex');const passwordHash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
 const make=(name,role,phone)=>prisma.user.create({data:{name,role,phone,passwordHash}});
 const root=await make('مدير نظام اختبار','SUPER_ADMIN','0500000001');
 const admin=await make('إداري اختبار','ADMIN','0500000002');const client=await make('عميل اختبار','CLIENT','0500000003');const vendorUser=await make('مورد اختبار','VENDOR','0500000004');
 const vendor=await prisma.vendor.create({data:{userId:vendorUser.id,businessName:'مورد اختبار',businessNameEn:'Test',categoryId:'test',cityId:'riyadh',logo:'',bannerImage:'',neighborhood:'',bioAr:'',cancellationPolicyAr:'',contactPhone:vendorUser.phone,whatsappNumber:vendorUser.phone,status:'ACTIVE'}});
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3101'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>{logs+=d;});server.stderr.on('data',d=>{logs+=d;});
 let ready=false;const deadline=Date.now()+90000;
 while(Date.now()<deadline){try{const r=await fetch(base+'/api/features');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,logs.slice(-3000));
 const login=async user=>{const r=await call('/api/auth/login','POST',{identifier:user.phone,password});assert.equal(r.status,200,JSON.stringify(r.data));return r;};
 const rootLogin=await login(root),adminLogin=await login(admin),clientLogin=await login(client),vendorLogin=await login(vendorUser);
 assert.equal(rootLogin.data.user.hasSystemAccess,true);assert.equal(adminLogin.data.user.hasSystemAccess,false);
 assert.equal((await call('/api/system-admin')).status,401);
 for(const cookie of [adminLogin.cookie,clientLogin.cookie,vendorLogin.cookie]) {
  assert.equal((await call('/api/system-admin','GET',undefined,cookie)).status,403);
  assert.equal((await call('/api/system-admin','POST',{action:'feature',id:'zaffah_generator',version:0,visible:true,enabled:true},cookie)).status,403);
 }
 assert.equal((await call('/api/system-admin','GET',undefined,rootLogin.cookie)).status,200);
 const poem={brideName:'نورة',groomName:'أحمد',familyName:'العائلة',occasionCity:'الرياض',zaffahStyle:'royal'};
 let features=(await call('/api/features')).data.features;let generator=features.find(f=>f.id==='zaffah_generator');assert.equal(generator.enabled,false);assert.equal(generator.visible,false);
 assert.equal((await call('/api/zaffah/generate','POST',poem)).status,403);
 async function feature(id,visible,enabled){const all=(await call('/api/features')).data.features;const f=all.find(f=>f.id===id);return call('/api/system-admin','POST',{action:'feature',...f,visible,enabled},rootLogin.cookie);}
 assert.equal((await feature('zaffah_generator',true,false)).status,200);
 assert.equal((await call('/api/zaffah/generate','POST',poem)).status,403);
 assert.equal((await feature('zaffah_generator',true,true)).status,200);
 const selectedLocation=await call('/api/geo/location','POST',{source:'MANUAL',cityId:'riyadh'});assert.equal(selectedLocation.status,200);
 const generated=await call('/api/zaffah/generate','POST',poem,selectedLocation.cookie);assert.equal(generated.status,200);assert(generated.data.poem.includes('نورة'));
 assert.equal((await feature('folk_arts',true,false)).status,200);
 const disabledHtml=await (await fetch(base+'/zaffah')).text();assert(disabledHtml.includes('الخدمة غير متاحة حالياً'));assert(!disabledHtml.includes('مُولّد نصوص وقصائد الزفة بالذكاء الاصطناعي'));
 assert.equal((await call('/api/zaffah/generate','POST',poem)).status,403);
 await feature('folk_arts',true,true);await feature('zaffah_generator',false,false);
 // The setup flow binds the privileged role to a named single-use token.
 const setupToken=randomBytes(32).toString('base64url');const {createHash}=require('node:crypto');
 await prisma.systemSetupToken.create({data:{tokenHash:createHash('sha256').update(setupToken).digest('hex'),email:'setup@example.com',expiresAt:new Date(Date.now()+60000)}});
 assert.equal((await call('/api/system-setup','POST',{action:'inspect',token:setupToken})).data.email,'setup@example.com');
 const activation=await call('/api/system-setup','POST',{action:'activate',token:setupToken,name:'مدير جديد',phone:'0500000006',password});assert.equal(activation.status,200);assert.equal(activation.data.user.hasSystemAccess,true);
 assert.equal((await call('/api/system-setup','POST',{action:'activate',token:setupToken,name:'آخر',phone:'0500000007',password})).status,410);
 // Remove this temporary extra manager before checking the last-manager invariant.
 await prisma.user.delete({where:{id:activation.data.user.id}});
 // Concurrent/stale feature edits must be rejected.
 features=(await call('/api/features')).data.features;generator=features.find(f=>f.id==='zaffah_generator');
 assert.equal((await call('/api/system-admin','POST',{action:'feature',...generator},rootLogin.cookie)).status,200);
 assert.equal((await call('/api/system-admin','POST',{action:'feature',...generator},rootLogin.cookie)).status,409);
 // No caller may remove the final active system administrator.
 const rootData=await prisma.user.findUniqueOrThrow({where:{id:root.id}});
 assert.equal((await call('/api/system-admin','POST',{action:'updateUser',...rootData,updatedAt:rootData.updatedAt.toISOString(),role:'ADMIN'},rootLogin.cookie)).status,409);
 // Promoting an administrator revokes their old session and exposes the new flag only after login.
 let account=await prisma.user.findUniqueOrThrow({where:{id:admin.id}});
 assert.equal((await call('/api/system-admin','POST',{action:'updateUser',...account,updatedAt:account.updatedAt.toISOString(),role:'SUPER_ADMIN'},rootLogin.cookie)).status,200);
 assert.equal((await call('/api/auth/session','GET',undefined,adminLogin.cookie)).data.user,null);
 assert.equal((await login(admin)).data.user.hasSystemAccess,true);
 // Suspended users lose existing access, and cannot sign back in.
 account=await prisma.user.findUniqueOrThrow({where:{id:client.id}});
 assert.equal((await call('/api/system-admin','POST',{action:'updateUser',...account,updatedAt:account.updatedAt.toISOString(),isActive:false},rootLogin.cookie)).status,200);
 assert.equal((await call('/api/auth/session','GET',undefined,clientLogin.cookie)).data.user,null);
 assert.equal((await call('/api/auth/login','POST',{identifier:client.phone,password})).status,401);
 assert.equal((await call('/api/catalog/vendors')).data.vendors.length,1);
 const changed=await call('/api/system-admin','POST',{action:'updateVendor',id:vendor.id,businessName:vendor.businessName,status:'SUSPENDED',verified:false,updatedAt:vendor.updatedAt.toISOString()},rootLogin.cookie);assert.equal(changed.status,200,JSON.stringify(changed.data));
 assert.equal((await call('/api/catalog/vendors')).data.vendors.length,0);
 const created=await call('/api/system-admin','POST',{action:'createUser',name:'إداري جديد',phone:'0500000005',email:'',role:'ADMIN',password},rootLogin.cookie);assert.equal(created.status,200);
 const audit=await prisma.systemAuditLog.findMany();assert(audit.some(a=>a.action==='USER_CREATED'));assert(audit.some(a=>a.action==='VENDOR_UPDATED'));assert(!JSON.stringify(audit).includes(password));
 const dashboard=await call('/api/system-admin?kind=admins','GET',undefined,rootLogin.cookie);assert(dashboard.data.users.every(u=>['ADMIN','SUPER_ADMIN'].includes(u.role)));assert(!JSON.stringify(dashboard.data).includes(passwordHash));
 await feature('commerce',true,false);assert.equal((await call('/api/oms/orders','POST',{})).status,403);
 console.log('PASS: isolated schema; separate system/admin permissions, default generator shutdown, server-side service gates, feature version conflicts, last-manager protection, user creation, session revocation, vendor suspension and audit privacy.');
})().catch(e=>{console.error(e);console.error(logs.slice(-1800));process.exitCode=1;}).finally(async()=>{
 if(server?.pid){if(process.platform==='win32')spawnSync('C:\\Windows\\System32\\taskkill.exe',['/pid',String(server.pid),'/T','/F'],{stdio:'ignore'});else server.kill('SIGTERM');}
 if(/^system_admin_test_[a-f0-9]{16}$/.test(schema))await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
 await prisma.$disconnect();try{fs.rmSync(path.resolve(dist),{recursive:true,force:true});fs.rmSync(testTsconfig,{force:true});}catch{}
});
