import 'server-only';
import { prisma } from '@/lib/db';
import { digest } from '@/lib/server/auth';
export async function recordGeoEvent(kind:'VISIT'|'DENIED'|'REQUEST',cityId:string|null,countryCode:string|null,serviceKey:string,visitorHash:string|null){
 const policy=await prisma.geoPolicy.findUnique({where:{id:'default'}});if(!policy?.analyticsEnabled||!visitorHash)return;
 if(!countryCode&&cityId)countryCode=(await prisma.saudiCity.findUnique({where:{id:cityId},select:{countryCode:true}}))?.countryCode||null;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),cityKey=cityId||'UNKNOWN',countryKey=countryCode||'UNKNOWN';
 // Visits are daily sessions per place, not unique people or unique IPs.
 const id=digest([visitorHash,day,cityKey,countryKey,serviceKey,kind,kind==='VISIT'?'day':Math.floor(Date.now()/60000)].join(':'));
 await prisma.$transaction(async tx=>{
  const inserted=await tx.geoSessionEvent.createMany({data:[{id,expiresAt:new Date(Date.now()+2*86400000)}],skipDuplicates:true});if(!inserted.count)return;
  await tx.geoDailyMetric.upsert({where:{day_cityKey_countryKey_serviceKey_kind:{day,cityKey,countryKey,serviceKey,kind}},create:{day,cityKey,countryKey,serviceKey,kind,count:1},update:{count:{increment:1}}});
 });
 await prisma.geoSessionEvent.deleteMany({where:{expiresAt:{lt:new Date()}}});
}
