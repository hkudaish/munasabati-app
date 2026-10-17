import { Availability, GeoChange, GeoSelection, GeoSnapshot, GeoStatus } from './types';
export const normalizePlace = (value:string) => value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLocaleLowerCase().replace(new RegExp('[^\\p{L}\\p{N}]','gu'),'');
export function matchCity(snapshot:GeoSnapshot,countryCode:string,names:string[]):string|null {
  const aliases = new Set(names.filter(Boolean).map(normalizePlace));
  const matches=snapshot.cities.filter(city=>city.countryCode===countryCode && [city.nameAr,city.nameEn,...city.aliases].some(n=>aliases.has(normalizePlace(n))));
  return matches.length===1?matches[0].id:null;
}
export function availability(snapshot:GeoSnapshot, selection:GeoSelection, now = new Date()):Availability[] {
  const city=snapshot.cities.find(c=>c.id===selection.cityId);
  const country=snapshot.countries.find(c=>c.code===(city?.countryCode||selection.countryCode));
  return snapshot.services.map(service=>{
    let status:GeoStatus='AVAILABLE',reason='',message='';
    const rule=city?snapshot.rules.find(r=>r.cityId===city.id&&r.key===service.key):undefined;
    if(!service.enabled){status='UNAVAILABLE';reason='الخدمة موقوفة على مستوى المنصة';}
    else if(country&&!country.enabled){status='UNAVAILABLE';reason='الخدمات غير متاحة في هذه الدولة حالياً';}
    else if(!city){if(snapshot.policy.unknownCity!=='ALLOW'){status='UNAVAILABLE';reason='اختر مدينة مسجلة للتحقق من توفر الخدمة';}}
    else if(!country){status='UNAVAILABLE';reason='تغطية الدولة غير محددة';}
    else if(!city.isAvailable){status='UNAVAILABLE';reason='الخدمات غير متاحة في هذه المدينة حالياً';}
    else if(rule){
      status=rule.status;reason=rule.reason||'';message=rule.message||'';
      if(rule.startsAt&&now<new Date(rule.startsAt)){status='SOON';reason=reason||'لم تبدأ فترة الإتاحة';}
      else if(rule.endsAt&&now>=new Date(rule.endsAt)){status='UNAVAILABLE';reason=reason||'انتهت فترة الإتاحة';}
    }else if(!city.defaultAvailable||(service.kind==='item'&&service.cityId!==city.id)) {status='UNAVAILABLE';reason='الخدمة غير مفعلة لهذه المدينة';}
    if(!reason&&status!=='AVAILABLE')reason=status==='SOON'?'قريباً؛ لا يتوفر الحجز حالياً':'الخدمة غير متاحة حالياً';
    return {key:service.key,available:status==='AVAILABLE',status,reason,message};
  });
}
export function summary(snapshot:GeoSnapshot,selection:GeoSelection,items=availability(snapshot,selection)) {
  if(!snapshot.cities.some(c=>c.id===selection.cityId))return 'UNKNOWN' as const;
  const relevant=items.filter(a=>snapshot.services.some(s=>s.key===a.key&&s.enabled&&s.visible));
  const count=relevant.filter(a=>a.available).length;
  return !count?'NONE' as const:count===relevant.length?'FULL' as const:'PARTIAL' as const;
}
export function applyChanges(input:GeoSnapshot,changes:GeoChange[]):GeoSnapshot {
  const s:GeoSnapshot=JSON.parse(JSON.stringify(input));
  for(const change of changes){
    if(change.type==='country'){const row=s.countries.find(c=>c.code===change.id);if(row)row.enabled=change.enabled;}
    if(change.type==='city'){const row=s.cities.find(c=>c.id===change.id);if(row){row.isAvailable=change.enabled;if(change.defaultAvailable!==undefined)row.defaultAvailable=change.defaultAvailable;}}
    if(change.type==='policy')s.policy=change.value;
    if(change.type==='rules')for(const cityId of change.cityIds)for(const key of change.keys){s.rules=s.rules.filter(r=>r.cityId!==cityId||r.key!==key);s.rules.push({cityId,key,status:change.status,startsAt:change.startsAt,endsAt:change.endsAt,reason:change.reason,message:change.message});}
    if(change.type==='copy'){const originals=s.rules.filter(r=>r.cityId===change.sourceId);for(const cityId of change.targetIds){s.rules=s.rules.filter(r=>r.cityId!==cityId);s.rules.push(...originals.map(r=>({...r,cityId})));const source=s.cities.find(c=>c.id===change.sourceId),target=s.cities.find(c=>c.id===cityId);if(source&&target)target.defaultAvailable=source.defaultAvailable;}}
  }
  return s;
}
