// Language routing helpers, placeholder formatting, and dictionary coverage: every Arabic text passed to t() in the code has an English entry
// with the same {placeholders}, and no English entry is left empty or in Arabic.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('typescript');
const assert = require('node:assert/strict');

const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const m = { exports: {} }; cache[file] = m;
  new Function('module', 'exports', 'require', js)(m, m.exports, spec => {
    const base = spec.startsWith('./') || spec.startsWith('../') ? path.resolve(path.dirname(file), spec) : null;
    if (!base) return require(spec);
    for (const c of [base + '.ts', path.join(base, 'index.ts')]) if (fs.existsSync(c)) return load(c);
    throw new Error('cannot resolve ' + spec);
  });
  return m.exports;
}
const root = path.resolve(__dirname, '..');
const locale = load(path.join(root, 'src/lib/i18n/locale.ts'));
const { format } = load(path.join(root, 'src/lib/i18n/format.ts'));
const { EN } = load(path.join(root, 'src/lib/i18n/dictionary.ts'));
let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

// paths
eq(locale.stripLocale('/en'), '/'); eq(locale.stripLocale('/en/commerce'), '/commerce'); eq(locale.stripLocale('/english'), '/english'); eq(locale.stripLocale('/commerce'), '/commerce');
eq(locale.localeOfPath('/en/commerce'), 'en'); eq(locale.localeOfPath('/commerce'), 'ar'); eq(locale.localeOfPath('/en'), 'en'); eq(locale.localeOfPath('/entertainment'), 'ar');
eq(locale.localizePath('/', 'en'), '/en'); eq(locale.localizePath('/commerce?q=cake', 'en'), '/en/commerce?q=cake');
eq(locale.localizePath('/commerce/service/abc', 'en'), '/en/commerce/service/abc'); eq(locale.localizePath('/en/commerce', 'ar'), '/commerce');
eq(locale.localizePath('/admin', 'en'), '/admin', 'untranslated pages keep their Arabic address'); eq(locale.localizePath('/vendor/catalog', 'en'), '/vendor/catalog');
eq(locale.localizePath('https://x.test/a', 'en'), 'https://x.test/a'); eq(locale.localizePath('//evil.test', 'en'), '//evil.test');
eq(locale.counterpart('/commerce', 'ar'), '/en/commerce'); eq(locale.counterpart('/admin', 'ar'), null); eq(locale.counterpart('/en/commerce', 'en'), '/commerce');
eq(locale.isTranslatedPath('/commerce/cart'), true); eq(locale.isTranslatedPath('/commerce/manage'), false); eq(locale.isTranslatedPath('/'), true);

// placeholders
eq(format('مرحباً {name}', { name: 'سارة' }), 'مرحباً سارة'); eq(format('Hi {name}', { name: 'Sara' }), 'Hi Sara'); eq(format('{a} {missing}', { a: 1 }), '1 {missing}'); eq(format('plain'), 'plain');

// dictionary coverage
const files = [];
(function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name) && /use(T)\(\)|getT\(\)/.test(fs.readFileSync(p, 'utf8')) && !p.includes(path.join('lib', 'i18n'))) files.push(p); } })(path.join(root, 'src'));
cp.execFileSync('node', [path.join(__dirname, 'i18n-scan.cjs'), ...files], { cwd: root });
const scan = JSON.parse(fs.readFileSync(path.join(__dirname, '.i18n-scan.json'), 'utf8'));
const used = new Set(); Object.values(scan.keys).forEach(list => list.forEach(k => used.add(k)));
const holes = [...used].filter(k => /[؀-ۿ]/.test(k) && !(k in EN));
assert.equal(holes.length, 0, 'texts without an English entry:\n' + holes.join('\n')); checks++;
const slots = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
const bad = Object.entries(EN).filter(([k, v]) => !v.trim() || slots(k) !== slots(v));
assert.equal(bad.length, 0, 'empty or placeholder mismatch:\n' + bad.map(([k]) => k).join('\n')); checks++;
const leaked = Object.entries(EN).filter(([, v]) => /[؀-ۿ]/.test(v));
assert.equal(leaked.length, 0, 'English entries containing Arabic letters:\n' + leaked.map(([k]) => k).join('\n')); checks++;
console.log(`i18n: ${checks} checks passed; ${used.size} texts in use, ${Object.keys(EN).length} dictionary entries`);
