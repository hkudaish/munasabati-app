const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process');
module.exports=async function catalogBrowser(base,clientCookie,vendorCookie,artistId,serviceId){
 const executable=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);assert(executable,'Chrome or Edge required for browser checks');
 const profile=path.resolve('.geo-browser-catalog-'+process.pid),browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--remote-debugging-port=9232','--user-data-dir='+profile],{stdio:'ignore'});let ws;
 try{
 let target;for(let i=0;i<60;i++){try{target=await(await fetch('http://127.0.0.1:9232/json/new?about:blank',{method:'PUT'})).json();break;}catch{}await new Promise(r=>setTimeout(r,250));}assert(target);
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map();
 ws.onmessage=e=>{const d=JSON.parse(e.data);if(pending.has(d.id)){pending.get(d.id)(d);pending.delete(d.id);}};
 const send=(method,params={})=>new Promise((r,j)=>{const key=++id,timer=setTimeout(()=>j(Error(method+' timed out')),20000);pending.set(key,d=>{clearTimeout(timer);d.error?j(Error(JSON.stringify(d.error))):r(d.result)});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const d=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(d.exceptionDetails)throw Error(d.exceptionDetails.text);return d.result.value;};
 const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate('Boolean('+expression+')'))return;await new Promise(r=>setTimeout(r,200));}throw Error('UI timeout: '+expression+'; '+await evaluate('document.body.innerText.slice(0,1800)'));};
 const click=async text=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.trim()===${JSON.stringify(text)}).click()`);
 const cookie=async value=>{const i=value.indexOf('=');await send('Network.setCookie',{name:value.slice(0,i),value:value.slice(i+1),url:base,httpOnly:true,sameSite:'Lax'});};
 await send('Page.enable');await send('Network.enable');await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await cookie(clientCookie);
 await send('Page.navigate',{url:base+'/plan'});await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText.trim()==='التالي')`);
 await evaluate(`fetch('/api/geo/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'MANUAL',cityId:'riyadh'})}).then(r=>{if(!r.ok)throw Error('location')})`);
 await send('Page.navigate',{url:base+'/plan'});
 await wait(`document.body.innerText.includes('اختبار التصنيفات') && Array.from(document.querySelectorAll('button')).some(b=>b.innerText.trim()==='التالي' && Object.keys(b).some(k=>k.startsWith('__reactProps$')))`);
 for(let i=1;i<=5;i++){await wait(`document.body.innerText.includes('الخطوة ${i} من 7') && Array.from(document.querySelectorAll('button')).some(b=>b.innerText.trim()==='التالي'&&!b.disabled)`);await click('التالي');await wait(`document.body.innerText.includes('الخطوة ${i+1} من 7')`);}
 await wait(`document.body.innerText.includes('ما هي الخدمات والتجهيزات التي تحتاجها')`);
 await click('تنظيم وتجهيز المناسبات');await wait(`document.querySelector('[data-service-options="event_setup"]')`);
 await evaluate(`Array.from(document.querySelectorAll('[data-service-options="event_setup"] label')).find(l=>l.innerText.trim()==='تجهيز حفلات الزواج كاملة').querySelector('input').click()`);
 await click('عروض وفنون وترفيه');await wait(`document.querySelector('[data-service-options="entertainment"]')`);
 await evaluate(`Array.from(document.querySelectorAll('[data-service-options="entertainment"] label')).find(l=>l.innerText.trim()==='حجز فنان للحفل').querySelector('input').click()`);
 await wait(`document.querySelector('[data-service-options="entertainment"] select')?.options.length>1`);
 await evaluate(`(()=>{const select=document.querySelector('[data-service-options="entertainment"] select');select.value=${JSON.stringify(artistId)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 fs.mkdirSync('.geo-test-artifacts',{recursive:true});
 for(const width of[390,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.geo-test-artifacts/catalog-plan-'+width+'.png',Buffer.from(shot.data,'base64'));const overflow=await evaluate(`Array.from(document.querySelectorAll('[data-service-options], [data-service-options] select')).map(e=>({tag:e.tagName,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:innerWidth})).filter(r=>r.left<0||r.right>r.width+1)`);assert.deepEqual(overflow,[],JSON.stringify(overflow));}
 await click('التالي');await wait(`document.body.innerText.includes('محمد عبده')&&document.body.innerText.includes('تجهيز حفلات الزواج كاملة')`);
 await click('توليد "خطة مناسبتي" وفتح مساحة العمل');await wait(`location.pathname.startsWith('/occasion/')&&document.body.innerText.includes('الخدمات والاختيارات المطلوبة')&&document.body.innerText.includes('محمد عبده')`);
 await send('Page.reload');await wait(`document.body.innerText.includes('محمد عبده')&&document.body.innerText.includes('تجهيز حفلات الزواج كاملة')`);
 await send('Page.navigate',{url:base+'/artists?artist='+artistId});await wait(`document.querySelector('a[href="/service/${serviceId}"]')`);
 await send('Page.navigate',{url:base+'/service/'+serviceId});await wait(`document.body.innerText.includes('محمد عبده')&&Array.from(document.querySelectorAll('button')).some(b=>b.innerText.trim()==='متابعة طلب الحجز')`);
 await cookie(vendorCookie);await send('Page.navigate',{url:base+'/vendor/catalog'});await wait(`document.body.innerText.includes('خدمات متجري ومعرض الأعمال')&&document.querySelector('input[type="url"]')`);
 assert.equal(await evaluate(`document.querySelector('input[type="url"]').value`),'https://example.invalid/library');
 await click('+ إضافة خدمة');await wait(`document.querySelector('[aria-labelledby="service-editor-title"]')`);
 await wait(`Array.from(document.querySelectorAll('[aria-labelledby="service-editor-title"] select option')).some(o=>o.innerText==='حجز فنان للحفل')`);
 console.log('PASS browser: nested planner selections and artist dropdown, mobile/desktop layout, real occasion save/reload, artist service discovery, booking entry, persisted supplier media editor.');
 }finally{try{ws?.close()}catch{}if(browser?.pid)spawnSync('C:\\Windows\\System32\\taskkill.exe',['/pid',String(browser.pid),'/T','/F'],{stdio:'ignore'});try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
};
