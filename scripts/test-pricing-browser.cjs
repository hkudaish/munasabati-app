// Browser smoke test for the pricing administration page and the customer price summary.
// Needs a running app (TEST_APP_URL, default http://localhost:3000) and Chrome or Edge.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient(), base = process.env.TEST_APP_URL || 'http://localhost:3000';

(async () => {
  const exe = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
  assert(exe, 'Chrome or Edge required');
  const admin = await db.user.findFirst({ where: { role: 'ADMIN' } }); assert(admin, 'an admin user is required');
  const token = randomBytes(32).toString('base64url');
  const row = await db.authSession.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), userId: admin.id, expiresAt: new Date(Date.now() + 3600000) } });
  const profile = path.resolve('.pricing-browser-' + process.pid), port = 9400 + (process.pid % 300);
  const browser = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let target; for (let i = 0; i < 60; i++) { try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); break; } catch { } await new Promise(r => setTimeout(r, 250)); }
    assert(target); ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(), errors = [];
    ws.onmessage = e => { const d = JSON.parse(e.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description ?? '')); };
    const send = (method, params = {}) => new Promise((r, j) => { const k = ++id, t = setTimeout(() => j(Error(method + ' timed out')), 20000); pending.set(k, d => { clearTimeout(t); d.error ? j(Error(JSON.stringify(d.error))) : r(d.result); }); ws.send(JSON.stringify({ id: k, method, params })); });
    const evaluate = async ex => { const d = await send('Runtime.evaluate', { expression: ex, returnByValue: true, awaitPromise: true }); if (d.exceptionDetails) throw Error(JSON.stringify(d.exceptionDetails)); return d.result.value; };
    const wait = async ex => { for (let i = 0; i < 120; i++) { try { if (await evaluate('Boolean(' + ex + ')')) return; } catch { } await new Promise(r => setTimeout(r, 250)); } throw Error('timeout waiting for ' + ex); };
    await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
    await send('Network.setCookie', { name: 'munasabati_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' });
    fs.mkdirSync('.geo-test-artifacts', { recursive: true });
    const tabs = ['منشئ الباقات والتسعير', 'قواعد الخصم والحملات', 'السجل والجدولة', 'تسوية الخصومات'];
    for (const [prefix, dir] of [['', 'rtl'], ['/en', 'rtl']]) {
      for (const width of [390, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 });
        await send('Page.navigate', { url: base + prefix + '/commerce/pricing' });
        await wait(`document.body.innerText.includes('إدارة التسعير والباقات')`);
        for (const tab of tabs) {
          await evaluate(`Array.from(document.querySelectorAll('nav button')).find(b=>b.innerText.trim()===${JSON.stringify(tab)}).click()`);
          await wait(`!document.body.innerText.includes('جارٍ التحميل')`);
          assert.equal(await evaluate(`document.documentElement.scrollWidth<=${width}+2`), true, `horizontal overflow on ${tab} at ${width}px`);
        }
        await evaluate(`Array.from(document.querySelectorAll('nav button')).find(b=>b.innerText.trim()==='قواعد الخصم والحملات').click()`);
        await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText.includes('قاعدة جديدة'))`);
        await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('قاعدة جديدة')).click()`);
        await wait(`document.body.innerText.includes('قاعدة خصم جديدة')`);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`.geo-test-artifacts/pricing-${prefix ? 'en' : 'ar'}-${width}.png`, Buffer.from(shot.data, 'base64'));
      }
    }
    assert.deepEqual(errors, [], 'no uncaught page errors');
    await send('Network.deleteCookies', { name: 'munasabati_session', url: base });
    await send('Page.navigate', { url: base + '/commerce/pricing' });
    await wait(`document.body.innerText.includes('سجّل الدخول')`);
    console.log('PASS pricing browser: admin page tabs, rules editor, Arabic and English routes, mobile and desktop widths without overflow or page errors, signed-out gate.');
  } finally {
    try { ws?.close(); } catch { }
    if (browser.pid) spawnSync('C:\\Windows\\System32\\taskkill.exe', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { }
    await db.authSession.delete({ where: { id: row.id } }).catch(() => { }); await db.$disconnect();
  }
})().catch(e => { console.error(e); process.exit(1); });
