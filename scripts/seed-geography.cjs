// Reuse existing service/feature IDs; never reset published country or feature switches.
async function seedGeography(prisma){
 const fs=require('node:fs'),ts=require('typescript');
 const file=require('node:path').resolve(__dirname,'../src/lib/system/feature-catalog.ts');const m={exports:{}};
 new Function('exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports);
 await prisma.geoCountry.upsert({where:{code:'SA'},create:{code:'SA',nameAr:'السعودية',nameEn:'Saudi Arabia',enabled:true},update:{}});
 await prisma.systemFeature.createMany({data:m.exports.FEATURE_CATALOG.map(f=>({id:f.id,visible:f.visible,enabled:f.enabled})),skipDuplicates:true});
 const categoriesFile=require('node:path').resolve(__dirname,'../src/lib/system/service-categories.ts');const categories={exports:{}};
 new Function('exports',ts.transpileModule(fs.readFileSync(categoriesFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(categories.exports);
 await prisma.serviceCategory.createMany({data:categories.exports.SERVICE_CATEGORIES.map((c,i)=>({...c,itemCount:0,sortOrder:i})),skipDuplicates:true});
 await prisma.geoPolicy.upsert({where:{id:'default'},create:{id:'default'},update:{}});
 await prisma.geoRevision.upsert({where:{id:'default'},create:{id:'default'},update:{}});
 await prisma.saudiCity.updateMany({where:{countryCode:null},data:{countryCode:'SA',defaultAvailable:true}});
}
module.exports={seedGeography};
if(require.main===module){const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();seedGeography(p).then(()=>console.log('Geographic defaults seeded without overwriting published switches.')).catch(e=>{console.error(e.code||e.message);process.exitCode=1;}).finally(()=>p.$disconnect());}
