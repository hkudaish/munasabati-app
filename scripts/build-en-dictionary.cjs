// Turns scripts/en-*.txt ("arabic => english" per line) into src/lib/i18n/en/common.ts, checked against the keys the code really uses.
//   node scripts/build-en-dictionary.cjs            (also scans the source for t('…') texts and reports any without an English line)
const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const cp = require('node:child_process');
const root = path.join(dir, '..');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name) && /useT\(\)|getT\(\)/.test(fs.readFileSync(p, 'utf8')) && !p.includes(path.join('lib', 'i18n'))) files.push(p); } })(path.join(root, 'src'));
cp.execFileSync('node', [path.join(dir, 'i18n-scan.cjs'), ...files], { cwd: root });
const scan = JSON.parse(fs.readFileSync(path.join(dir, '.i18n-scan.json'), 'utf8'));
const keys = [...new Set(Object.values(scan.keys).flat())].filter(k => /[؀-ۿ]/.test(k));
const byTrim = new Map(keys.map(k => [k.trim(), k]));
const entries = {};
const unknown = [];
for (const f of fs.readdirSync(dir).filter(n => /^en-c?\d+\.txt$/.test(n)).sort()) {
  for (const raw of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const i = raw.indexOf(' => ');
    if (i < 0) { unknown.push('NO SEPARATOR: ' + raw.slice(0, 60)); continue; }
    const ar = raw.slice(0, i).trim(), en = raw.slice(i + 4).trim();
    const key = byTrim.get(ar) || ar; // texts that are not code literals (status tables, data content, server messages) are keyed by themselves
    const lead = key.match(/^\s*/)[0], trail = key.match(/\s*$/)[0];
    entries[key] = lead + en + (key.trim() ? trail : '');
  }
}
const missing = keys.filter(k => !(k in entries));
const body = Object.entries(entries).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
fs.writeFileSync(path.join(dir, '..', 'src', 'lib', 'i18n', 'en', 'common.ts'), `// Generated from scripts/en-*.txt by scripts/build-en-dictionary.cjs — edit those files, not this one.\nexport const EN_COMMON: Record<string, string> = {\n${body}\n};\n`);
console.log('entries', Object.keys(entries).length, '| missing', missing.length, '| unknown lines', unknown.length);
missing.forEach(m => console.log('MISSING:', m));
unknown.forEach(m => console.log(m));
