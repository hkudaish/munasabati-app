// RFC 4180-style parsing, including BOM, quoted commas/newlines and escaped quotes.
export function parseCSV(input:string):Record<string,string>[] {
 if(input.length>2000000)throw Error('حجم الملف يتجاوز 2 ميغابايت');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 const value=input.replace(/^\uFEFF/,'');
 for(let i=0;i<value.length;i++){const c=value[i];if(c==='"'){if(quoted&&value[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw Error('اقتباس غير صالح في CSV');}
 else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==','){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&value[i+1]==='\n')i++;}}
 else cell+=c;}
 if(quoted)throw Error('علامة اقتباس غير مغلقة');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const head=rows.shift()?.map(x=>x.trim())||[];if(new Set(head).size!==head.length||!head.length)throw Error('عناوين CSV غير صالحة');
 if(rows.length>300)throw Error('الحد الأقصى 300 صف في الاستيراد');
 return rows.map((r,i)=>{if(r.length!==head.length)throw Error('عدد الأعمدة غير مطابق في السطر '+(i+2));return Object.fromEntries(head.map((h,n)=>[h,r[n].trim()]));});
}
export function csvFile(rows:Record<string,unknown>[]):string {const keys=Object.keys(rows[0]||{});const escape=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+[keys.map(escape).join(','),...rows.map(r=>keys.map(k=>escape(r[k])).join(','))].join('\r\n');}
