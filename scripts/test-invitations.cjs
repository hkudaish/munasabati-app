// Run with: node scripts/test-invitations.cjs (uses the existing TypeScript dependency).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(output.outputText, filename);
};
const { BUILTIN_TEMPLATES, DEFAULT_DESIGN, OCCASIONS, SIZES, validateDesign, validateTemplate, occasionKind, contrastRatio } = require('../src/lib/invitations/catalog.ts');
const { cardSvg } = require('../src/lib/invitations/render.ts');
assert.equal(BUILTIN_TEMPLATES.length, 18);
assert.equal(new Set(BUILTIN_TEMPLATES.map(t => t.id)).size, 18);
for (const kind of new Set(BUILTIN_TEMPLATES.map(t => t.occasion))) assert.equal(BUILTIN_TEMPLATES.filter(t => t.occasion === kind).length, 3);
assert.equal(new Set(BUILTIN_TEMPLATES.map(t => t.occasion)).size, 6);
for (const template of BUILTIN_TEMPLATES) {
  assert.deepEqual(validateTemplate(JSON.parse(JSON.stringify(template))), { ...template, reviewNote: undefined });
  assert(contrastRatio(template.design.background, template.design.foreground) >= 4.5);
}
assert.equal(occasionKind('melka'), 'engagement');
assert.equal(occasionKind('corporate_opening'), 'formal');
assert.equal(occasionKind('family_gathering'), 'family');
assert.equal(occasionKind('__proto__'), 'family');
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, image: 'javascript:alert(1)' }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, image: 'data:image/svg+xml;base64,PHN2Zz4=' }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, background: 'red" onload="alert(1)' }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, size: '__proto__' }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, motif: 'constructor' }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, titleSize: NaN }));
assert.throws(() => validateDesign({ ...DEFAULT_DESIGN, offset: 81 }));
assert.throws(() => validateTemplate({ ...BUILTIN_TEMPLATES[0], status: 'administrator' }));
const hostile = cardSvg({ ...DEFAULT_DESIGN, title: '<script>alert("bad")</script>&' });
assert(!hostile.includes('<script>'));
assert(hostile.includes('&lt;script&gt;'));
const original = JSON.stringify(BUILTIN_TEMPLATES[0]);
const copy = { ...BUILTIN_TEMPLATES[0].design, title: 'عنوان مستقل' };
cardSvg(copy);
assert.equal(JSON.stringify(BUILTIN_TEMPLATES[0]), original);
for (const [size, dimensions] of Object.entries(SIZES)) {
  const svg = cardSvg({ ...DEFAULT_DESIGN, size, title: 'دعوة '.repeat(20), opening: 'يسعدنا حضوركم '.repeat(18), venue: 'الموقع '.repeat(30), closing: 'شكراً '.repeat(30) });
  assert(svg.includes(`width="${dimensions.width}" height="${dimensions.height}"`));
  assert(!svg.includes('NaN'));
  assert.match(svg, /scale\(0\./); // Long text must shrink into the safe region.
}
console.log('Invitation catalog, validation, escaping, copying, contrast and size checks passed.');

const { createInvitationLink, readInvitationSnapshot, normalizeInvitationOrigin, codeFromScan } = require('../src/lib/invitations/link.ts');
const { qrSvg } = require('../src/lib/invitations/qr.ts');
const jsQR = require('jsqr');
const publicEvent = { id: 'occ-101', title: 'حفل زواج أحمد ونورة 🤍', date: '2026-11-12', time: '08:00 مساءً', venueName: 'قاعة الرياض', cityNameAr: 'الرياض' };
const url = createInvitationLink('https://example.com', { ...publicEvent, senderPhone: 'PRIVATE', budget: 50000 });
assert.deepEqual(readInvitationSnapshot(new URL(url).hash, 'MUN-DEMO-occ-101'), publicEvent);
assert.equal(readInvitationSnapshot(new URL(url).hash, 'MUN-DEMO-occ-102'), null);
assert.equal(readInvitationSnapshot('#inv=malformed', 'MUN-DEMO-occ-101'), null);
assert.equal(readInvitationSnapshot('#inv=' + 'a'.repeat(5001), 'MUN-DEMO-occ-101'), null);
assert.throws(() => normalizeInvitationOrigin('javascript:alert(1)'));
assert.throws(() => normalizeInvitationOrigin('https://user:pass@example.com'));
assert.equal(codeFromScan(createInvitationLink('http://192.168.1.2:3000', publicEvent, 'MUN-GST-101-01')), 'MUN-GST-101-01');
assert.equal(codeFromScan('MUN-GST-101-01'), 'MUN-GST-101-01');
assert.equal(codeFromScan('https://example.com/unrelated'), '');
const snapshotData = JSON.stringify(readInvitationSnapshot(new URL(url).hash, 'MUN-DEMO-occ-101'));
assert(!snapshotData.includes('PRIVATE'));
assert(!snapshotData.includes('budget'));
// Rasterize the actual SVG path, then decode it with an independent reader.
const svg = qrSvg(url);
const cells = Number(svg.match(/viewBox="0 0 (\d+) /)[1]);
const scale = 5, width = cells * scale;
const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
for (const match of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
  const x = Number(match[1]) * scale, y = Number(match[2]) * scale;
  for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
    const index = ((y + dy) * width + x + dx) * 4;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
  }
}
assert.equal(jsQR(pixels, width, width)?.data, url);
const exportedCard = cardSvg(DEFAULT_DESIGN, url);
assert(exportedCard.includes(svg.match(/<path d="([^"]+)"/)[1]));
assert(exportedCard.includes('امسح لفتح الدعوة'));
console.log('Portable Arabic links, privacy, malformed links, guest codes and independent QR decoding checks passed.');
