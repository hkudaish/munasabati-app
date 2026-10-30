// Real-browser check of the exception screens (Chrome or Edge, headless, phone width): the notice hint and dialog in the storefront, the request form,
// the customer's request page, the staff dashboard and the vendor approval page. Called from test-exceptions.cjs with RUN_EXC_BROWSER=1.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { spawn, spawnSync } = require('node:child_process');
module.exports = async function exceptionsBrowser({ base, cookies, serviceId, offerId, near, call, shots }) {
  const executable = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync); assert(executable, 'Chrome or Edge required');
  const port = 9300 + (process.pid % 300), profile = path.resolve('.exc-browser-' + process.pid), browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', `--remote-debugging-port=${port}`, '--user-data-dir=' + profile], { stdio: 'ignore' }); let ws;
  try {
    let target; for (let i = 0; i < 60; i++) { try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); break; } catch { } await new Promise(r => setTimeout(r, 250)); } assert(target);
    ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); let id = 0; const pending = new Map();
    ws.onmessage = e => { const d = JSON.parse(e.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
    const send = (method, params = {}) => new Promise((r, j) => { const k = ++id, t = setTimeout(() => j(Error(method + ' timed out')), 30000); pending.set(k, d => { clearTimeout(t); d.error ? j(Error(JSON.stringify(d.error))) : r(d.result); }); ws.send(JSON.stringify({ id: k, method, params })); });
    const evaluate = async ex => { const d = await send('Runtime.evaluate', { expression: ex, returnByValue: true, awaitPromise: true }); if (d.exceptionDetails) throw Error(JSON.stringify(d.exceptionDetails).slice(0, 600)); return d.result.value; };
    const wait = async (ex, what = ex) => { for (let i = 0; i < 200; i++) { try { if (await evaluate('Boolean(' + ex + ')')) return; } catch (e) { if (!/Cannot read properties of null|context was destroyed|Cannot find context|Execution context/.test(e.message)) throw e; } await new Promise(r => setTimeout(r, 200)); } throw Error('UI timeout: ' + what + '\n' + await evaluate('document.body.innerText.slice(0,1500)')); };
    const click = text => evaluate(`(()=>{const b=Array.from(document.querySelectorAll('button,a')).find(b=>b.innerText.trim()===${JSON.stringify(text)});if(!b)throw Error('no button '+${JSON.stringify(text)});b.click();return true})()`);
    const fill = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('no field '+${JSON.stringify(selector)});const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    const cookie = async value => { const i = value.indexOf('='); await send('Network.setCookie', { name: value.slice(0, i), value: value.slice(i + 1), url: base, httpOnly: true, sameSite: 'Lax' }); };
    const overflow = async label => { const r = await evaluate(`(()=>{const w=innerWidth,out=[];for(const e of document.querySelectorAll('body *')){const b=e.getBoundingClientRect();if(b.width&&(b.right>w+2||b.left<-2)){let clipped=false;for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){const s=getComputedStyle(a);if(/(auto|scroll|hidden)/.test(s.overflowX)){clipped=true;break}}if(!clipped)out.push(e.tagName+'.'+String(e.className).slice(0,50))}}return{doc:document.documentElement.scrollWidth,w,out:out.slice(0,6)}})()`); assert(r.doc <= r.w + 2, `${label}: horizontal overflow (${r.doc} > ${r.w}) ${r.out.join(', ')}`); assert(!r.out.length, `${label}: elements outside the screen: ${r.out.join(', ')}`); };
    const shot = async name => { if (!shots) return; const d = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(d.data, 'base64')); };
    const go = async (url, text) => { await send('Page.navigate', { url: base + url }); if (text) await wait(`document.body.innerText.includes(${JSON.stringify(text)})`, text); };
    await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });

    // 1. the customer picks a time that is too close
    await cookie(cookies.customer);
    await go('/commerce/service/' + serviceId, 'خيارات شراء الخدمة');
    await evaluate(`fetch('/api/geo/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'MANUAL',cityId:'riyadh'})}).then(r=>{if(!r.ok)throw Error('location')})`);
    await go('/commerce/service/' + serviceId, 'خيارات شراء الخدمة');
    await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText.includes('اختر العرض'))`, 'offer button'); await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('اختر العرض')).click()`);
    await wait(`document.querySelector('[role=dialog] input[type=date]')`, 'selection dialog'); await fill('[role=dialog] input[type=date]', near); await fill('[role=dialog] input[type=time]', '20:30');
    await wait(`document.body.innerText.includes('تحتاج هذه الخدمة إلى')`, 'the notice hint'); await shot('1-hint'); await overflow('storefront hint');
    await click('اختر موعداً آخر أو اطلب استثناء'); await wait(`document.body.innerText.includes('نعتذر منك، الموعد الذي اخترته')`, 'the notice dialog'); await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText.trim()==='طلب استثناء')`);
    for (const must of ['يمكنك اختيار موعد لاحق، أو تقديم طلب استثناء', 'قد يترتب عليها زيادة في سعر الخدمة', 'موافق', 'أقرب موعد متاح']) assert((await evaluate('document.body.innerText')).includes(must), 'dialog text: ' + must);
    assert(await evaluate(`(()=>{const el=Array.from(document.querySelectorAll('[role=dialog]')).find(d=>d.innerText.includes('نعتذر منك'));const b=el.getBoundingClientRect();const top=document.elementFromPoint(b.left+b.width/2,b.top+40);return el.contains(top)})()`), 'the notice dialog is on top of the booking dialog');
    await shot('2-dialog'); await overflow('notice dialog');
    await click('طلب استثناء'); await wait(`document.body.innerText.includes('سبب طلب الاستثناء')`, 'the form'); await shot('3-form-top'); await overflow('exception form');
    assert(await evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').required`), 'the acknowledgement is required');
    assert(await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('إرسال طلب الاستثناء')).disabled`), 'sending is disabled until the acknowledgement is ticked');
    await fill('[role=dialog] textarea[required]', 'تغير موعد الحفل بسبب ظرف عائلي مفاجئ'); await evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click()`);
    await click('إرسال طلب الاستثناء'); await wait(`document.body.innerText.includes('تم إرسال طلب الاستثناء')`, 'the confirmation'); await shot('4-sent'); await overflow('exception sent');
    const number = (await evaluate(`document.body.innerText.match(/EX-\\d{8}-[A-Z2-9]{6}/)?.[0]`)); assert(number, 'a reference number is shown');
    await click('متابعة الطلب'); await wait(`document.body.innerText.includes(${JSON.stringify(number)})&&document.body.innerText.includes('المرحلة 1')`, 'the request page');
    for (const must of ['الموافقة التشغيلية', 'اعتماد السعر النهائي', 'التأكيد النهائي للحجز', 'بانتظار موافقة مقدم الخدمة', 'إلغاء الطلب', 'سجل الإجراءات']) assert((await evaluate('document.body.innerText')).includes(must), 'request page text: ' + must);
    const requestPath = await evaluate('location.pathname'); await shot('5-request'); await overflow('customer request page');

    // 2. the list the customer sees, and the provider's view
    await go('/exceptions', number); await shot('6-list'); await overflow('customer list');
    await cookie(cookies.vendor); await go('/exceptions', number); await go(requestPath); await wait(`document.body.innerText.includes('الموافقة التشغيلية على إمكانية التنفيذ')`, 'the provider approval section'); await shot('7-provider'); await overflow('provider request page');
    assert(!(await evaluate('document.body.innerText')).includes('إلغاء الطلب\n'), 'a provider cannot cancel');

    // 3. staff: the dashboard with counters, filters and the table
    await cookie(cookies.admin); await go('/admin/exceptions', 'إدارة طلبات الاستثناء وتعديل المواعيد'); await wait(`document.body.innerText.includes('إجمالي طلبات الاستثناء')&&document.querySelector('table')`, 'the dashboard');
    for (const must of ['الطلبات الجديدة', 'قيد المراجعة', 'بانتظار موافقة المورد', 'بانتظار موافقة العميل', 'بانتظار الدفع', 'الطلبات المؤكدة', 'الطلبات المرفوضة', 'الطلبات المتأخرة', 'طلبات تعديل المواعيد', 'تصدير CSV']) assert((await evaluate('document.body.innerText')).includes(must), 'dashboard text: ' + must);
    await wait(`document.body.innerText.includes('مدد الاستجابة والتصعيد')&&document.body.innerText.includes('فريق المتابعة')`, 'the settings'); await shot('8-dashboard'); await overflow('dashboard (the table scrolls inside its own box)');
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('بانتظار موافقة المورد')).click()`); await wait(`document.querySelectorAll('tbody tr').length>=1`, 'filtered rows');
    await go('/admin/vendor-approvals', 'اعتماد حسابات الموردين'); await shot('9-vendor-approvals'); await overflow('vendor approvals');

    // 4. a customer who is not staff is told no to the staff screens
    await cookie(cookies.customer); await go('/admin/exceptions'); await wait(`document.body.innerText.includes('يلزم تسجيل الدخول بحساب إداري')`, 'admin guard');
    return { number };
  } finally { try { ws?.close(); } catch { } if (browser.pid) spawnSync('C:\\Windows\\System32\\taskkill.exe', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { } }
};
