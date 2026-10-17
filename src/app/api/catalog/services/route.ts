import { publicServiceWhere } from '@/lib/server/catalog';
import { prisma } from '@/lib/db';
import { api } from '@/lib/server/http';
export const dynamic='force-dynamic';
export const GET=api(async()=>{
 const [rows,cities]=await Promise.all([prisma.serviceItem.findMany({where:publicServiceWhere,include:{vendor:true,category:true,subcategory:true,artist:true,packages:true,addons:true,availability:true},orderBy:{createdAt:'desc'}}),prisma.saudiCity.findMany()]);
 return {services:rows.map(s=>({...s,priceType:s.priceType.toLowerCase(),vendorName:s.vendor.businessName,vendorRating:s.vendor.rating,vendorLogo:s.vendor.logo,categoryNameAr:s.category.nameAr,cityNameAr:cities.find(c=>c.id===s.cityId)?.nameAr||'',vendor:undefined,category:undefined,packages:s.packages.map(p=>({...p,tier:p.tier.toLowerCase()})),addons:s.addons.map(a=>({...a,pricingType:a.pricingType.toLowerCase()}))}))};
});
