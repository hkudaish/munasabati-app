// Measures real network timing to a URL from wherever you run it (your phone hotspot, office, home).
// Usage: node scripts/measure-speed.mjs [url ...]   (defaults to the production pages below)
import https from 'node:https';

const base = 'https://munasabit.netlify.app';
const urls = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/marketplace', '/commerce', '/api/health/db'].map(p => base + p);
const RUNS = 5;

function once(url) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint(), at = {};
    const ms = () => Number(process.hrtime.bigint() - t0) / 1e6;
    const req = https.get(url, { agent: false, headers: { 'accept-encoding': 'gzip, br', 'user-agent': 'measure-speed' } }, res => {
      at.firstByte = ms(); let bytes = 0;
      res.on('data', c => { bytes += c.length; });
      res.on('end', () => resolve({ ...at, total: ms(), status: res.statusCode, bytes }));
    });
    req.on('socket', s => {
      s.on('lookup', () => { at.dns = ms(); });
      s.on('connect', () => { at.connect = ms(); });
      s.on('secureConnect', () => { at.tls = ms(); });
    });
    req.on('error', reject);
  });
}
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

for (const url of urls) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) { try { runs.push(await once(url)); } catch (e) { console.log(url, 'ERROR', e.message); } }
  if (!runs.length) continue;
  const f = k => Math.round(median(runs.map(r => r[k] ?? 0)));
  console.log(`${url}\n  status ${runs[0].status} | dns ${f('dns')}ms | connect ${f('connect')}ms | tls ${f('tls')}ms | first byte ${f('firstByte')}ms | total ${f('total')}ms | ${Math.round(runs[0].bytes / 1024)}kB (median of ${runs.length})`);
}
console.log('\nRule of thumb: first byte minus tls = server time. If connect/tls are slow, the delay is your network path, not the app.');
