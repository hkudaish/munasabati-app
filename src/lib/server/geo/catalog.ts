import 'server-only';
import { inflateRawSync } from 'node:zlib';
import { HttpError } from '@/lib/server/http';
async function download(path:string){const r=await fetch('https://download.geonames.org/export/dump/'+path,{signal:AbortSignal.timeout(20000),redirect:'error',next:{revalidate:86400}});if(!r.ok)throw new HttpError(503,'تعذر قراءة المصدر الجغرافي؛ يمكن الاستيراد عبر CSV');const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>15000000)throw new HttpError(413,'ملف المصدر كبير؛ استخدم CSV محدداً');return bytes;}
function unzipCountry(buffer:Buffer,name:string){
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}if(end<0)throw Error('Invalid archive');
 let cursor=buffer.readUInt32LE(end+16);const count=buffer.readUInt16LE(end+10);
 for(let i=0;i<count;i++){if(buffer.readUInt32LE(cursor)!==0x02014b50)throw Error('Invalid directory');const method=buffer.readUInt16LE(cursor+10),size=buffer.readUInt32LE(cursor+20),uncompressed=buffer.readUInt32LE(cursor+24),nl=buffer.readUInt16LE(cursor+28),el=buffer.readUInt16LE(cursor+30),cl=buffer.readUInt16LE(cursor+32),local=buffer.readUInt32LE(cursor+42),filename=buffer.subarray(cursor+46,cursor+46+nl).toString();
  if(filename===name){if(uncompressed>50000000||local+30>buffer.length)throw Error('Archive too large');const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);if(start+size>buffer.length)throw Error('Invalid archive');const data=buffer.subarray(start,start+size);return (method===0?data:method===8?inflateRawSync(data,{maxOutputLength:50000000}):Buffer.alloc(0)).toString('utf8');}cursor+=46+nl+el+cl;
 }throw Error('Country file absent');
}
export async function countryCatalog(){const txt=(await download('countryInfo.txt')).toString();const ar=new Intl.DisplayNames(['ar'],{type:'region'});return txt.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('\t')).filter(a=>/^[A-Z]{2}$/.test(a[0])).map(a=>({code:a[0],nameAr:ar.of(a[0])||a[4],nameEn:a[4],enabled:false}));}
export async function cityCatalog(code:string){
 if(!/^[A-Z]{2}$/.test(code)||!(await countryCatalog()).some(c=>c.code===code))throw new HttpError(400,'اختر رمز دولة صحيحاً');
 const [zip,regionsText]=await Promise.all([download(code+'.zip'),download('admin1CodesASCII.txt')]);
 const regions=new Map(regionsText.toString().split('\n').map(l=>{const a=l.split('\t');return [a[0],a[1]];}));
 const rows=unzipCountry(zip,code+'.txt').split('\n').map(l=>l.split('\t')).filter(a=>a[6]==='P'&&Number(a[14])>=5000).sort((a,b)=>Number(b[14])-Number(a[14])).slice(0,300);
 return rows.map(a=>{const aliases=a[3].split(',').filter(Boolean).slice(0,40);const nameAr=aliases.find(n=>/[\u0600-\u06ff]/.test(n))||a[1];const regionId=code+'.'+a[10];return {countryCode:code,cityId:'geonames-'+a[0],nameAr,nameEn:a[2]||a[1],externalId:'geonames:'+a[0],regionId,regionAr:regions.get(regionId)||a[10]||code,regionEn:regions.get(regionId)||a[10]||code,aliases:aliases.join('|')};});
}
