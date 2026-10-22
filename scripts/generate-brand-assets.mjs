// Regenerates the static brand images in /public (Open Graph cards, app icons).
//   npm i --no-save satori @resvg/resvg-js && node scripts/generate-brand-assets.mjs
// The results are committed, so nothing is rendered or fetched at request time. The Arabic wordmark uses Tajawal (SIL OFL, assets/fonts).
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const font = fs.readFileSync(path.join(root, 'assets/fonts/Tajawal-Bold.ttf'));
const GREEN = '#004D3F', DEEP = '#001F19', GOLD = '#C59B27', SAND = '#FAF7F2';
// satori takes a plain element tree: { type, props: { style, children } }
const el = (type, style, ...children) => ({ type, props: { style, children: children.length === 1 ? children[0] : children } });
const starPoints = Array.from({ length: 16 }, (_, i) => { const a = Math.PI * i / 8 - Math.PI / 2, r = i % 2 ? 26 : 46; return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
const star = size => ({ type: 'svg', props: { width: size, height: size, viewBox: '0 0 100 100', children: [{ type: 'polygon', props: { points: starPoints, fill: GOLD } }, { type: 'circle', props: { cx: 50, cy: 50, r: 9, fill: DEEP } }] } });
async function write(name, tree, width, height) {
  const svg = await satori(tree, { width, height, fonts: [{ name: 'Tajawal', data: font, weight: 700, style: 'normal' }] });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  fs.writeFileSync(path.join(root, 'public', name), png);
  console.log('wrote public/' + name, png.length + ' bytes');
}
const icon = (size, padding) => el('div', { width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GREEN }, star(Math.round(size * (1 - 2 * padding))));
await write('icon-192.png', icon(192, 0.18), 192, 192);
await write('icon-512.png', icon(512, 0.18), 512, 512);
await write('icon-maskable-512.png', icon(512, 0.3), 512, 512); // extra safe zone for adaptive icons
await write('apple-touch-icon.png', icon(180, 0.18), 180, 180);
await write('icon-32.png', icon(32, 0.12), 32, 32);
const card = tagline => el('div', { width: 1200, height: 630, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${DEEP}, ${GREEN})`, color: SAND, fontFamily: 'Tajawal', padding: 60 },
  star(150),
  el('div', { display: 'flex', fontSize: 120, fontWeight: 700, marginTop: 20 }, 'مناسبتـي'),
  el('div', { display: 'flex', fontSize: 40, marginTop: 6, color: GOLD, letterSpacing: 6 }, 'MUNASABATI'),
  el('div', { display: 'flex', fontSize: 44, marginTop: 36, direction: isArabic(tagline) ? 'rtl' : 'ltr' }, tagline));
function isArabic(text) { return /[؀-ۿ]/.test(text); }
await write('og-default.png', card('خططها. احجزها. اعزمهم. احتفل.'), 1200, 630);
await write('og-default-en.png', card('Plan it. Book it. Invite them. Celebrate.'), 1200, 630);
