// Local operator-only invitation for a named new system administrator.
// SYSTEM_ADMIN_EMAIL=... node --env-file=.env scripts/create-system-setup.cjs
const { PrismaClient }=require('@prisma/client'); const { randomBytes,createHash }=require('node:crypto');
const prisma=new PrismaClient();
(async()=>{
 const email=(process.env.SYSTEM_ADMIN_EMAIL||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Set SYSTEM_ADMIN_EMAIL.');
 if(await prisma.user.findUnique({where:{email}}))throw Error('Account already exists. Use provision-system-admin.cjs instead.');
 const token=randomBytes(32).toString('base64url'); const tokenHash=createHash('sha256').update(token).digest('hex');const expiresAt=new Date(Date.now()+24*3600000);
 await prisma.$transaction(async tx=>{
  await tx.systemSetupToken.updateMany({where:{email,consumedAt:null},data:{consumedAt:new Date()}});
  await tx.systemSetupToken.create({data:{email,tokenHash,expiresAt}});
  await tx.systemAuditLog.create({data:{actorId:'LOCAL_OPERATOR',action:'SYSTEM_ADMIN_INVITED',targetId:email}});
 });
 const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000').origin;
 console.log(JSON.stringify({email,setupUrl:origin+'/system-setup#token='+token,expiresAt:expiresAt.toISOString()}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
