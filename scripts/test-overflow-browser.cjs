// Finds horizontal overflow on signed-in screens at phone width. Needs a running app (TEST_APP_URL, default http://localhost:3000) and Chrome or Edge.
// Usage: node scripts/test-overflow-browser.cjs [ADMIN|VENDOR|CLIENT] /path /path ...
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient(), base = process.env.TEST_APP_URL || 'http://localhost:3000';
const role = ['ADMIN', 'VENDOR', 'CLIENT'].includes(process.argv[2]) ? process.argv[2] : 'ADMIN';
const paths = process.argv.slice(['ADMIN', 'VENDOR', 'CLIENT'].includes(process.argv[2]) ? 3 : 2); if (!paths.length) paths.push('/', '/admin', '/commerce/pricing');
(async () => {
  const exe = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync); assert(exe, 'Chrome or Edge required');
  const user = await db.user.findFirst({ where: { role } }); assert(user, 'no ' + role + ' user');
  const token = randomBytes(32).toString('base64url');
  const row = await db.authSession.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: new Date(Date.now() + 1800000) } });
  const profile = path.resolve('.overflow-browser-' + process.pid), port = 9700 + (process.pid % 200);
  const browser = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws; const bad = [];
  try {
    let target; for (let i = 0; i < 60; i++) { try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); break; } catch { } await new Promise(r => setTimeout(r, 250)); }
    ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map();
    ws.onmessage = e => { const d = JSON.parse(e.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
    const send = (method, params = {}) => new Promise((r, j) => { const k = ++id, t = setTimeout(() => j(Error(method + ' timed out')), 20000); pending.set(k, d => { clearTimeout(t); d.error ? j(Error(JSON.stringify(d.error))) : r(d.result); }); ws.send(JSON.stringify({ id: k, method, params })); });
    const evaluate = async ex => { const d = await send('Runtime.evaluate', { expression: ex, returnByValue: true, awaitPromise: true }); if (d.exceptionDetails) throw Error(JSON.stringify(d.exceptionDetails)); return d.result.value; };
    await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
    await send('Network.setCookie', { name: 'munasabati_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    for (const p of paths) {
      await send('Page.navigate', { url: base + p }); await new Promise(r => setTimeout(r, 3500));
      if (process.env.HIDE) await evaluate(`document.querySelectorAll(${JSON.stringify(process.env.HIDE)}).forEach(e => e.style.display = 'none')`);
      const r = await evaluate(`(() => { const w = 390, out = []; for (const e of document.querySelectorAll('body *')) { const b = e.getBoundingClientRect(); if (b.width && (b.right > w + 2 || b.left < -2)) { const s = getComputedStyle(e); if (s.position === 'fixed' || s.display === 'none' || e.closest('[class*="fixed"]')) continue; let clipped = false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) { clipped = true; break; } } if (!clipped) out.push((e.tagName + '.' + String(e.className).split(' ').slice(0, 3).join('.')).slice(0, 90) + ' ' + Math.round(b.left) + '..' + Math.round(b.right)); } } window.__dbg = Array.from(document.querySelectorAll('div.justify-around')).map(d => Array.from(d.children).map(c => c.tagName + ':' + Math.round(c.getBoundingClientRect().width) + ':' + (c.innerText||'').slice(0,20)).join(' ; ')); out.sort((a, b) => parseInt(a.split(" ").pop().split('..')[0]) - parseInt(b.split(" ").pop().split('..')[0])); return { dbg: window.__dbg, doc: document.documentElement.scrollWidth, w: 390, out: out.slice(0, 8) }; })()`);
      const over = r.doc > r.w + 2; console.log(JSON.stringify(r.dbg)); console.log((over || r.out.length ? 'OVERFLOW ' : 'ok       ') + p + ' scrollWidth=' + r.doc + ' viewport=' + r.w); for (const o of r.out) console.log('    ' + o); if (over) bad.push(p);
    }
    if (bad.length) { process.exitCode = 1; console.log('FAIL horizontal overflow on: ' + bad.join(', ')); } else console.log('PASS no horizontal overflow at 390px as ' + role);
  } finally { try { ws?.close(); } catch { } if (browser.pid) spawnSync('C:\\Windows\\System32\\taskkill.exe', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { } await db.authSession.delete({ where: { id: row.id } }).catch(() => { }); await db.$disconnect(); }
})().catch(e => { console.error(e); process.exit(1); });
