import 'server-only';
import { prisma } from '@/lib/db';
import { FEATURE_CATALOG } from '@/lib/system/feature-catalog';
import { GeoSnapshot, Policy, Rule } from '@/lib/geo/types';
import { Prisma } from '@prisma/client';
export type GeoDB=Prisma.TransactionClient;
export const defaultPolicy:Policy={unknownCity:'PROMPT',hideUnavailable:true,analyticsEnabled:false,reverseEnabled:false,ipEnabled:true};
export async function readGeo(db:GeoDB=prisma):Promise<GeoSnapshot>{
 const [countries,cities,regions,features,services,rules,policy,revision]=await Promise.all([
  db.geoCountry.findMany({orderBy:{nameAr:'asc'}}),db.saudiCity.findMany({orderBy:[{sortOrder:'asc'},{nameAr:'asc'}]}),db.geoRegion.findMany({orderBy:{nameAr:'asc'}}),db.systemFeature.findMany(),
  db.serviceItem.findMany({select:{id:true,titleAr:true,cityId:true,vendorId:true,vendor:{select:{status:true,user:{select:{isActive:true}}}}}}),db.geoRule.findMany(),db.geoPolicy.findUnique({where:{id:'default'}}),db.geoRevision.findUnique({where:{id:'default'}})
 ]);
 return {revision:revision?.version||0,countries,cities,regions,policy:(policy||defaultPolicy) as Policy,
  services:[...features.map(f=>({key:'feature:'+f.id,id:f.id,name:FEATURE_CATALOG.find(d=>d.id===f.id)?.name||f.id,kind:'feature' as const,enabled:f.enabled,visible:f.visible})),...services.map(s=>({key:'item:'+s.id,id:s.id,name:s.titleAr,kind:'item' as const,enabled:s.vendor.status==='ACTIVE'&&s.vendor.user?.isActive!==false,visible:true,cityId:s.cityId,vendorId:s.vendorId}))],
  rules:rules.map(r=>({cityId:r.cityId,key:r.featureId?'feature:'+r.featureId:'item:'+r.serviceId,status:r.status,startsAt:r.startsAt?.toISOString(),endsAt:r.endsAt?.toISOString(),reason:r.reason,message:r.message})) as Rule[]};
}
