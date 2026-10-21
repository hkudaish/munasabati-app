// Run with: node scripts/test-invitation-library.cjs
// Checks the 24-template library: structure, metadata, validation, palettes, every layout at every size, optional-field handling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(output.outputText, filename);
};
const { LAYOUTS, SIZES, AUDIENCES, DEFAULT_DESIGN, validateDesign, validateTemplate, contrastRatio, dateParts, hijriOf, occasionKind } = require('../src/lib/invitations/catalog.ts');
const { LIBRARY_TEMPLATES, COLLECTIONS, thumbnailDesign, startingDesign } = require('../src/lib/invitations/library.ts');
const { cardSvg } = require('../src/lib/invitations/render.ts');

// ---- the catalog ----
assert.equal(LIBRARY_TEMPLATES.length, 24);
assert.equal(new Set(LIBRARY_TEMPLATES.map(t => t.id)).size, 24);
assert.equal(new Set(LIBRARY_TEMPLATES.map(t => t.nameEn)).size, 24);
const expected = { men: 4, women: 4, engagement: 3, nikah: 3, general: 3, digital: 3, other: 4 };
for (const [collection, count] of Object.entries(expected)) assert.equal(LIBRARY_TEMPLATES.filter(t => t.collection === collection).length, count, collection);
assert.deepEqual(Object.keys(COLLECTIONS).sort(), Object.keys(expected).sort());
const layoutsUsed = new Set(LIBRARY_TEMPLATES.map(t => t.design.layout));
assert.equal(layoutsUsed.size, Object.keys(LAYOUTS).length - 1, 'every new layout is used, classic is not');
assert(!layoutsUsed.has('classic'));
for (const t of LIBRARY_TEMPLATES) {
  assert(Object.hasOwn(AUDIENCES, t.audience), t.id);
  assert.equal(t.status, 'published'); assert.equal(t.ownerId, 'system');
  const clean = validateTemplate(JSON.parse(JSON.stringify(t)));
  assert.equal(clean.id, t.id); assert.equal(clean.audience, t.audience);
  assert.equal(t.palettes.length, 3, t.id + ' palettes');
  assert.equal(new Set(t.palettes.map(p => p.background + p.accent)).size, 3, t.id + ' palettes differ');
  for (const p of t.palettes) {
    assert(contrastRatio(p.background, p.foreground) >= 4.5, `${t.id}/${p.name} text contrast ${contrastRatio(p.background, p.foreground).toFixed(2)}`);
    assert(contrastRatio(p.background, p.accent) >= 3, `${t.id}/${p.name} accent contrast ${contrastRatio(p.background, p.accent).toFixed(2)}`);
  }
}
assert(LIBRARY_TEMPLATES.filter(t => t.audience === 'men').length >= 4 && LIBRARY_TEMPLATES.filter(t => t.audience === 'women').length >= 4);
console.log('Library structure, metadata, collections, palettes and contrast checks passed.');

// ---- rendering: every template x palette x size, with the fullest, the longest and the emptiest content ----
const full = { groom: 'عبدالله بن محمد', bride: 'نورة بنت سعد', host: 'آل الحربي وآل القحطاني يتشرفون بدعوتكم', date: '2027-06-12', hijri: '6 ذو الحجة 1448', time: 'الثامنة والنصف مساءً', venue: 'قاعة الياسمين للاحتفالات', address: 'حي الملقا، طريق الملك فهد، الرياض', rsvpBy: '1 يونيو', contact: '0500000000', invocation: 'بسم الله الرحمن الرحيم' };
const long = { opening: 'يسعدنا حضوركم '.repeat(14), title: 'دعوة '.repeat(16), closing: 'شكراً '.repeat(30), venue: 'الموقع '.repeat(30), address: 'العنوان '.repeat(20), host: 'العائلة '.repeat(20) };
const empty = { groom: '', bride: '', host: '', hijri: '', address: '', rsvpBy: '', contact: '', invocation: '', date: '', time: '', venue: '' };
const qrUrl = 'https://example.com/invite/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
let rendered = 0;
for (const t of LIBRARY_TEMPLATES) for (const p of t.palettes) for (const size of Object.keys(SIZES)) for (const qr of ['', qrUrl]) for (const content of [full, { ...full, ...long }, empty]) {
  const d = { ...thumbnailDesign(t), ...content, background: p.background, foreground: p.foreground, accent: p.accent, size };
  const svg = cardSvg(validateDesign(d), qr);
  assert(!svg.includes('NaN') && !svg.includes('undefined') && !svg.includes('Infinity'), `${t.id}/${size}`);
  assert(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.equal((svg.match(/<g[ >]/g) || []).length, (svg.match(/<\/g>/g) || []).length, `${t.id}: balanced groups`);
  const scales = [...svg.matchAll(/scale\(([\d.]+)\)/g)].map(m => Number(m[1]));
  const floor = content === full ? 0.35 : content === empty ? 0.99 : 0.1; // realistic text must stay clearly legible; the stress text only has to fit
  assert(scales.every(s => s >= floor && s <= 1.0001), `${t.id}/${size}/${qr ? 'qr' : 'noqr'}: text scale below ${floor}, got ${scales}`);
  rendered++;
}
console.log(`Rendered ${rendered} variants (24 templates x 3 palettes x ${Object.keys(SIZES).length} sizes x QR on/off x 3 contents) without NaN, with balanced markup and legible scale.`);

// ---- optional fields vanish cleanly; no template invents text ----
const base = { ...thumbnailDesign(LIBRARY_TEMPLATES[0]), groom: '', bride: '', host: '', hijri: '', address: '', rsvpBy: '', contact: '', invocation: '', time: '' };
const without = cardSvg(validateDesign(base));
for (const word of ['تأكيد الحضور', 'للتواصل', 'بسم الله']) assert(!without.includes(word), `empty ${word} must not leave a trace`);
const withContact = cardSvg(validateDesign({ ...base, contact: '0555555555', rsvpBy: '1 يونيو' }));
assert(withContact.includes('0555555555') && withContact.includes('تأكيد الحضور'));
const names = cardSvg(validateDesign({ ...base, groom: 'فهد', bride: 'ريم' }));
assert(names.includes('فهد و ريم'));
// hostile input stays inert in every layout
for (const layout of Object.keys(LAYOUTS)) {
  const svg = cardSvg(validateDesign({ ...DEFAULT_DESIGN, layout, title: '<script>x</script>', groom: '"><img src=x onerror=1>', contact: '<b>', host: '&' }));
  assert(!svg.includes('<script>') && !svg.includes('<img') && !svg.includes('<b>'), layout);
}
// thumbnails show fictional people; a customer's starting design never carries them
const tpl = LIBRARY_TEMPLATES[0];
assert.notEqual(thumbnailDesign(tpl).groom, '');
const start = startingDesign(tpl, { title: 'حفل زفاف سامي', date: '2027-01-01' });
for (const key of ['groom', 'bride', 'host', 'contact', 'address', 'rsvpBy']) assert.equal(start[key], '', key);
assert.equal(start.title, 'حفل زفاف سامي');
console.log('Optional fields, hostile input and sample-data isolation checks passed.');

// ---- validation of the new fields ----
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, layout: '__proto__' }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, layout: 'nope' }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, groom: 'x'.repeat(161) }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, contact: 5 }));
const { layout, invocation, host, groom, bride, hijri, address, rsvpBy, contact, ...legacy } = DEFAULT_DESIGN;
const upgraded = validateDesign(legacy);
assert.equal(upgraded.layout, 'classic'); assert.equal(upgraded.groom, '');
assert.throws(() => validateTemplate({ ...LIBRARY_TEMPLATES[0], audience: 'aliens' }));
assert.equal(occasionKind('nikah'), 'nikah'); assert.equal(occasionKind('newborn'), 'newborn'); assert.equal(occasionKind('melka'), 'engagement');
assert.deepEqual(dateParts('2027-06-12'), { day: '12', month: 'يونيو', year: '2027' });
assert.equal(dateParts('next Friday'), null); assert.equal(dateParts('2027-13-01'), null);
const hj = hijriOf('2027-06-12'); assert(/1449|١٤٤٩/.test(hj), hj);
assert.equal(hijriOf('soon'), '');
assert(cardSvg(upgraded).includes('دعوة خاصة'), 'the classic layout still renders saved drafts');
console.log('New-field validation, legacy draft upgrade, dates and the classic layout checks passed.');
