const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process');
module.exports=async function serviceCommerceBrowser(base,clientCookie,adminCookie,serviceId,date){
 const executable=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);assert(executable,'Chrome or Edge required for browser checks');
 const profile=path.resolve('.geo-browser-md3-'+process.pid),browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--remote-debugging-port=9234','--user-data-dir='+profile],{stdio:'ignore'});let ws;
 try{
 let target;for(let i=0;i<60;i++){try{target=await(await fetch('http://127.0.0.1:9234/json/new?about:blank',{method:'PUT'})).json();break;}catch{}await new Promise(r=>setTimeout(r,250));}assert(target);
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map();
 ws.onmessage=e=>{const d=JSON.parse(e.data);if(pending.has(d.id)){pending.get(d.id)(d);pending.delete(d.id);}};
 const send=(method,params={})=>new Promise((r,j)=>{const key=++id,timer=setTimeout(()=>j(Error(method+' timed out')),20000);pending.set(key,d=>{clearTimeout(timer);d.error?j(Error(JSON.stringify(d.error))):r(d.result)});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const d=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(d.exceptionDetails)throw Error(JSON.stringify(d.exceptionDetails));return d.result.value;};
 const wait=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate('Boolean('+expression+')'))return;}catch(e){if(!/Cannot read properties of null|context was destroyed|Cannot find context|Execution context/.test(e.message))throw e;}await new Promise(r=>setTimeout(r,200));}throw Error('UI timeout: '+expression+'; '+await evaluate('document.body.innerText.slice(0,1800)'));};
 const click=async text=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.trim()===${JSON.stringify(text)}).click()`);
 const cookie=async value=>{const i=value.indexOf('=');await send('Network.setCookie',{name:value.slice(0,i),value:value.slice(i+1),url:base,httpOnly:true,sameSite:'Lax'});};
 await send('Page.enable');await send('Network.enable');await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await cookie(clientCookie);


 await send('Page.navigate',{url:base+'/commerce/service/'+serviceId});await wait(`document.body.innerText.includes('خيارات شراء الخدمة')`);
 await evaluate(`fetch('/api/commerce/cart').then(r=>r.json()).then(d=>fetch('/api/commerce/cart',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:d.cart.version,lines:[]})}))`);
 await evaluate(`fetch('/api/geo/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'MANUAL',cityId:'riyadh'})}).then(r=>{if(!r.ok)throw Error('location')})`);
 await send('Page.navigate',{url:base+'/commerce/service/'+serviceId});await wait(`document.body.innerText.includes('اختبار MD3 0')&&document.body.innerText.includes('md3-hour')&&document.body.innerText.includes('تتوفر هذه الخدمة أيضاً ضمن الباقات التالية')`);
 await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText.includes('اختر العرض وأضف للسلة')&&Object.keys(b).some(k=>k.startsWith('__reactProps$')))`);
 await evaluate(`Array.from(document.querySelectorAll('h3')).find(h=>h.innerText==='md3-hour').closest('div.border').querySelector('button').click()`);
 await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText==='إضافة للسلة المحفوظة')`);
 const fill=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const nextDate=new Date(Date.parse(date+'T12:00Z')+86400000).toISOString().slice(0,10);await fill('form input[type="date"]',nextDate);
 await click('إضافة للسلة المحفوظة');await wait(`document.body.innerText.includes('أضيف إلى سلتك المحفوظة')`);
 await send('Page.navigate',{url:base+'/commerce/cart'});await wait(`document.body.innerText.includes('الأسعار والشروط قبل إنشاء الطلب')&&document.body.innerText.includes('md3-hour')`);
 fs.mkdirSync('.geo-test-artifacts',{recursive:true});for(const width of[390,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width===390});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.geo-test-artifacts/md3-cart-'+width+'.png',Buffer.from(shot.data,'base64'));const overflow=await evaluate(`Array.from(document.querySelectorAll('main input,main select')).map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(r=>r.left<0||r.right>innerWidth+1)`);assert.deepEqual(overflow,[]);}
 await evaluate(`Array.from(document.querySelectorAll('label')).find(l=>l.innerText.includes('أوافق على الخيارات')).querySelector('input').click()`);await click('إنشاء الطلب ومتابعة الموافقات');await wait(`location.pathname==='/commerce/orders'&&document.body.innerText.includes('md3-hour')&&document.body.innerText.includes('محجوز مؤقتاً')`);
 await cookie(adminCookie);await send('Page.navigate',{url:base+'/commerce/manage'});await wait(`document.body.innerText.includes('خدمة فنان واحدة')&&document.body.innerText.includes('md3-hour')&&document.body.innerText.includes('md3-night')&&document.body.innerText.includes('md3-quote')`);
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.geo-test-artifacts/md3-management-1440.png',Buffer.from(shot.data,'base64'));
 console.log('PASS MD3 browser: one service with multiple offers, linked bundles, persisted cart without occasion, server checkout, independent booking/payment states, mobile/desktop layout, and management UI.');
 }finally{try{ws?.close()}catch{}if(browser?.pid)spawnSync('C:\\Windows\\System32\\taskkill.exe',['/pid',String(browser.pid),'/T','/F'],{stdio:'ignore'});try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
};
