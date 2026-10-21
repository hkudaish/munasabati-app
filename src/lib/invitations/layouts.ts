import { CardDesign, SIZES, dateParts } from './catalog';
const nice = (v: string) => { const p = dateParts(v); return p ? `${p.day} ${p.month} ${p.year}` : v; };
import { qrSvg } from './qr';

export const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function wrap(text: string, count: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const token of paragraph.split(/\s+/)) {
      for (let start = 0; start < token.length; start += count) {
        const word = token.slice(start, start + count);
        if (line && line.length + word.length + 1 > count) { lines.push(line); line = word; }
        else line += `${line ? ' ' : ''}${word}`;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface Area { x0: number; x1: number; y0: number; y1: number }
interface Block { zone: 'pre' | 'head' | 'body'; text: string; size: number; color: string; bold: boolean; gap: number; label?: string }
interface Ctx { d: CardDesign; w: number; h: number; qr: boolean; qrSize: number; a: string; f: string; b: string; initials: string }
interface Spec { align: 'center' | 'right' | 'user'; body: Area; head?: Area; pre?: Area; headInk?: boolean; rows?: boolean; ornament: string }

const star = (cx: number, cy: number, R: number, r: number, points = 8, rot = 0) => Array.from({ length: points * 2 }, (_, i) => {
  const a = Math.PI * i / points + rot - Math.PI / 2, k = i % 2 ? r : R;
  return `${(cx + k * Math.cos(a)).toFixed(1)},${(cy + k * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const diamond = (cx: number, cy: number, s: number) => `M${cx} ${cy - s} L${cx + s} ${cy} L${cx} ${cy + s} L${cx - s} ${cy}Z`;
const sprig = (c: Ctx, x: number, y: number, angle: number, scale = 1) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" stroke="${c.a}" fill="${c.a}"><path d="M0 150 Q90 70 150 0" fill="none" stroke-width="2"/>${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${20 + i * 20}" cy="${130 - i * 20}" rx="12" ry="28" transform="rotate(-45 ${20 + i * 20} ${130 - i * 20})" opacity=".3"/><ellipse cx="${40 + i * 18}" cy="${140 - i * 20}" rx="10" ry="25" transform="rotate(35 ${40 + i * 18} ${140 - i * 20})" opacity=".42"/>`).join('')}<circle cx="150" cy="0" r="6" opacity=".55"/></g>`;
const rule = (c: Ctx, y: number, half = 90) => `<path d="M${c.w / 2 - half} ${y} H${c.w / 2 - 16} M${c.w / 2 + 16} ${y} H${c.w / 2 + half}" stroke="${c.a}" stroke-width="1.2"/><path d="${diamond(c.w / 2, y, 7)}" fill="${c.a}"/>`;
const confetti = (c: Ctx, stars: boolean) => Array.from({ length: 30 }, (_, i) => {
  const px = 30 + (i * 137 % 540), py = i < 15 ? 25 + (i * 37 % 90) : c.h - 130 + (i * 43 % 100);
  return stars ? `<path d="M${px} ${py - 8} l3 6 7 2 -7 3 -3 7 -3 -7 -7 -3 7 -2Z" fill="${c.a}" opacity=".6"/>` : `<rect x="${px}" y="${py}" width="6" height="15" rx="2" fill="${i % 2 ? c.a : c.f}" opacity=".35" transform="rotate(${i * 29} ${px} ${py})"/>`;
}).join('');

function spec(layout: string, c: Ctx): Spec {
  const { w, h, a, f, b, d } = c, qr = c.qr ? c.qrSize + 45 : 0;
  const body = (x0: number, x1: number, y0: number, y1: number): Area => ({ x0, x1, y0, y1: y1 - qr });
  switch (layout) {
    case 'royal-frame': return { align: 'center', body: body(70, 530, 95, h - 90), ornament: `<rect x="14" y="14" width="${w - 28}" height="${h - 28}" fill="none" stroke="${a}" stroke-width="3"/><rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="${a}" opacity=".7"/>${[[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]].map(([x, y]) => `<path d="${diamond(x, y, 10)}" fill="${a}"/>`).join('')}${rule(c, 62)}${c.qr ? '' : rule(c, h - 62)}` };
    case 'arch-window': return { align: 'center', body: h < 700 ? body(135, 465, 128, h - 80) : body(112, 488, 175, h - 95), ornament: `<path d="M58 ${h - 40} V300 A242 242 0 0 1 542 300 V${h - 40}Z" fill="${a}" opacity=".09"/><path d="M58 ${h - 40} V300 A242 242 0 0 1 542 300 V${h - 40}" fill="none" stroke="${a}" stroke-width="2.5"/><path d="M76 ${h - 52} V304 A224 224 0 0 1 524 304 V${h - 52}" fill="none" stroke="${a}" opacity=".45"/>` };
    case 'band-header': { const band = Math.round(h * .3); return { align: 'center', head: { x0: 50, x1: 550, y0: 38, y1: band - 34 }, headInk: true, body: body(70, 530, band + 38, h - 60), ornament: `<rect width="${w}" height="${band}" fill="${a}"/><path d="M0 ${band + 9} H${w}" stroke="${a}" opacity=".5"/><path d="${diamond(w / 2, band, 11)}" fill="${b}" stroke="${a}" stroke-width="2"/>` }; }
    case 'monogram-circle': { const sq = h < 700, cy = sq ? 84 : 120, r = sq ? 52 : 76; return { align: 'center', body: body(80, 520, cy + r + 26, h - 70), ornament: `<circle cx="${w / 2}" cy="${cy}" r="${r}" fill="none" stroke="${a}" opacity=".45"/><circle cx="${w / 2}" cy="${cy}" r="${r - 10}" fill="none" stroke="${a}" stroke-width="2"/><text x="${w / 2}" y="${cy + (sq ? 12 : 19)}" text-anchor="middle" font-size="${sq ? 34 : 48}" font-weight="700" fill="${a}" direction="rtl">${escape(c.initials)}</text><path d="${diamond(w / 2, cy - r - 14, 5)} ${diamond(w / 2, cy + r + 14, 5)}" fill="${a}"/>` }; }
    case 'side-panel': { const p = dateParts(d.date); return { align: 'right', body: body(36, 410, 70, h - 70), ornament: `<rect x="${w - 150}" width="150" height="${h}" fill="${a}"/>${p ? `<text x="${w - 75}" y="${h / 2 - 20}" text-anchor="middle" font-size="64" font-weight="700" fill="${b}">${escape(p.day)}</text><text x="${w - 75}" y="${h / 2 + 20}" text-anchor="middle" font-size="22" fill="${b}" direction="rtl">${escape(p.month)}</text><text x="${w - 75}" y="${h / 2 + 50}" text-anchor="middle" font-size="16" fill="${b}" opacity=".85">${escape(p.year)}</text>` : `<polygon points="${star(w - 75, h / 2, 46, 24)}" fill="none" stroke="${b}" stroke-width="2"/>`}<path d="M${w - 150} 0 V${h}" stroke="${b}" opacity=".5"/>` }; }
    case 'floral-corners': return { align: 'center', body: body(90, 510, 120, h - 110), ornament: `${sprig(c, 30, 30, 0)}${sprig(c, w - 30, 30, 90)}${sprig(c, w - 30, h - 30, 180)}${sprig(c, 30, h - 30, 270)}<path d="M200 70 Q300 28 400 70" fill="none" stroke="${a}" opacity=".5"/>` };
    case 'star-medallion': { const sq = h < 700, cy = sq ? 98 : 142, R = sq ? 56 : 82; return { align: 'center', body: body(80, 520, cy + R + 20, h - 90), ornament: `<rect x="20" y="20" width="${w - 40}" height="${h - 40}" fill="none" stroke="${a}" stroke-width="2"/><rect x="30" y="30" width="${w - 60}" height="${h - 60}" fill="none" stroke="${a}" opacity=".5"/>${[[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]].map(([x, y]) => `<polygon points="${star(x, y, 17, 8)}" fill="${b}" stroke="${a}" stroke-width="1.5"/>`).join('')}<polygon points="${star(w / 2, cy, R, R * .68, 8)}" fill="${a}" opacity=".15"/><polygon points="${star(w / 2, cy, R, R * .68, 8)}" fill="none" stroke="${a}" stroke-width="2"/><polygon points="${star(w / 2, cy, R * .6, R * .41, 8, Math.PI / 8)}" fill="none" stroke="${a}"/><circle cx="${w / 2}" cy="${cy}" r="${R / 6}" fill="${a}"/>` }; }
    case 'envelope': { const tip = h * (h < 700 ? .2 : .3), side = tip * .4, top = tip * .67; return { align: 'center', body: body(95, 505, tip + 22, h - 85), ornament: `<rect x="40" y="${top}" width="${w - 80}" height="${h - top - 12}" rx="6" fill="#ffffff" opacity=".6"/><rect x="40" y="${top}" width="${w - 80}" height="${h - top - 12}" rx="6" fill="none" stroke="${a}" opacity=".5"/><path d="M0 0 H${w} V${side} L${w / 2} ${tip} L0 ${side}Z" fill="${a}"/><path d="M0 ${side} L${w / 2} ${tip} L${w} ${side}" fill="none" stroke="${b}" opacity=".55"/><circle cx="${w / 2}" cy="${tip}" r="22" fill="${f}"/><polygon points="${star(w / 2, tip, 14, 7, 6)}" fill="${a}"/>` }; }
    case 'ribbon-banner': return { align: 'center', pre: { x0: 50, x1: 550, y0: 52, y1: 112 }, head: { x0: 60, x1: 540, y0: 134, y1: 220 }, headInk: true, body: body(70, 530, 255, h - 70), ornament: `${confetti(c, true)}<path d="M0 120 H${w} L${w - 24} 177 L${w} 234 H0 L24 177Z" fill="${a}"/><path d="M0 234 H24 L0 258Z M${w} 234 H${w - 24} L${w} 258Z" fill="${a}" opacity=".6"/>` };
    case 'calligraphy': return { align: 'center', body: body(60, 540, 82, h - 82), ornament: `${Array.from({ length: 13 }, (_, i) => `<circle cx="${30 + i * 45}" cy="12" r="22" fill="none" stroke="${a}" opacity=".5"/>${c.qr ? '' : `<circle cx="${30 + i * 45}" cy="${h - 12}" r="22" fill="none" stroke="${a}" opacity=".5"/>`}`).join('')}<rect x="38" y="46" width="${w - 76}" height="${h - 92}" fill="none" stroke="${a}" opacity=".6"/>${rule(c, 60, 120)}${c.qr ? '' : rule(c, h - 60, 120)}` };
    case 'info-rows': return { align: 'user', rows: true, body: body(70, 520, 90, h - 70), ornament: `<path d="M548 70 V${h - 70}" stroke="${a}" stroke-width="3"/><path d="M548 70 h24 M548 ${h - 70} h24" stroke="${a}" stroke-width="3"/><polygon points="${star(70, 52, 14, 7, 4, Math.PI / 4)}" fill="${a}"/>` };
    case 'split-half': return { align: 'center', head: { x0: 28, x1: 222, y0: 60, y1: h - 60 }, headInk: true, body: body(262, 574, 70, h - 70), ornament: `<rect width="250" height="${h}" fill="${a}"/><rect x="258" width="2" height="${h}" fill="${a}" opacity=".6"/><polygon points="${star(125, 36, 12, 6, 6)}" fill="${b}" opacity=".8"/><polygon points="${star(125, h - 36, 12, 6, 6)}" fill="${b}" opacity=".8"/>` };
    default: return { align: 'center', body: body(60, 540, 90, h - 90), ornament: '' };
  }
}

function blocks(c: Ctx, rows: boolean): Block[] {
  const { d, a, f } = c, out: Block[] = [];
  const add = (zone: Block['zone'], text: string, size: number, color: string, bold = false, gap = 14, label?: string) => { if (text.trim()) out.push({ zone, text: text.trim(), size, color, bold, gap, label }); };
  const names = [d.groom, d.bride].filter(s => s.trim()).join('  و  ');
  add('pre', d.invocation, 19, a, true, 0);
  add('pre', d.opening, 16, f, false, 10);
  if (names) add('head', d.title, 18, a, true, 12);
  add('head', names || d.title, d.titleSize, a, true, 12);
  add('body', d.host, 16, f, false, 18);
  if (rows) {
    add('body', nice(d.date), 19, f, true, 20, 'التاريخ'); add('body', d.hijri, 15, f, false, 2);
    add('body', d.time, 19, f, true, 14, 'الوقت');
    add('body', d.venue, 18, f, true, 14, 'المكان'); add('body', d.address, 15, f, false, 2);
    add('body', nice(d.rsvpBy), 16, f, false, 14, 'تأكيد الحضور قبل');
    add('body', d.contact, 16, f, false, 14, 'للتواصل');
  } else {
    add('body', [nice(d.date), d.time].filter(Boolean).join('  ·  '), 19, f, true, 22); add('body', d.hijri, 15, f, false, 4);
    add('body', d.venue, 18, f, true, 14); add('body', d.address, 15, f, false, 4);
    add('body', d.rsvpBy ? `الرجاء تأكيد الحضور قبل ${nice(d.rsvpBy)}` : '', 15, a, false, 16);
    add('body', d.contact ? `للتواصل: ${d.contact}` : '', 15, f, false, 6);
  }
  add('body', d.closing, 15, f, false, 18);
  return out;
}

function flow(list: Block[], area: Area, align: 'center' | 'right', rows: boolean, family: string): string {
  if (!list.length) return '';
  const width = area.x1 - area.x0, ax = align === 'right' ? area.x1 : (area.x0 + area.x1) / 2, anchor = align === 'right' ? 'start' : 'middle'; // with direction=rtl, SVG's 'start' is the right-hand edge
  let y = 0; const parts: string[] = [];
  list.forEach((blk, i) => {
    const lines = wrap(blk.text, Math.max(8, Math.floor(width / (blk.size * .55))));
    if (i) y += blk.gap;
    if (blk.label) { parts.push(`<text x="${ax}" y="${y + 12}" text-anchor="${anchor}" direction="rtl" fill="currentColor" font-size="12" opacity=".7">${escape(blk.label)}</text>`); y += 18; }
    parts.push(`<text x="${ax}" y="${y + blk.size}" text-anchor="${anchor}" direction="rtl" unicode-bidi="plaintext" fill="${blk.color}" font-size="${blk.size}" font-weight="${blk.bold ? 700 : 400}">${lines.map((line, k) => `<tspan x="${ax}" dy="${k ? blk.size * 1.5 : 0}">${escape(line)}</tspan>`).join('')}</text>`);
    y += lines.length * blk.size * 1.5;
    if (rows && blk.label) { parts.push(`<path d="M${align === 'right' ? ax - width : ax - width / 2} ${y + 4} H${align === 'right' ? ax : ax + width / 2}" stroke="currentColor" opacity=".18"/>`); y += 6; }
  });
  const avail = area.y1 - area.y0, s = Math.min(1, avail / y), top = area.y0 + (avail - y * s) / 2;
  return `<g transform="translate(${ax * (1 - s)} ${top}) scale(${s})" font-family="${family}">${parts.join('')}</g>`;
}

export function layoutSvg(d: CardDesign, qrValue = ''): string {
  const size = SIZES[d.size], w = 600, h = 600 * size.height / size.width;
  const initial = (s: string) => Array.from(s.trim())[0] || '';
  const initials = (initial(d.groom) || initial(d.bride)) ? [initial(d.groom), initial(d.bride)].filter(Boolean).join(' ') : Array.from(d.title.replace(/\s+/g, '')).slice(0, 2).join(' ');
  const c: Ctx = { d, w, h, qr: !!qrValue, qrSize: h < 700 ? 96 : 124, a: d.accent, f: d.foreground, b: d.background, initials };
  const sp = spec(d.layout, c);
  const align = sp.align === 'user' ? d.align : sp.align;
  const family = d.font === 'serif' ? 'Georgia, Times New Roman, serif' : 'Arial, sans-serif';
  const list = blocks(c, !!sp.rows);
  const pre = list.filter(x => x.zone === 'pre'), main = list.filter(x => x.zone === 'head'), rest = list.filter(x => x.zone === 'body');
  const ink = (blks: Block[]) => blks.map(x => ({ ...x, color: sp.headInk ? d.background : x.color }));
  let content: string;
  if (sp.head && sp.pre) content = flow(pre, sp.pre, 'center', false, family) + flow(ink(main), sp.head, 'center', false, family) + flow(rest, sp.body, align, !!sp.rows, family);
  else if (sp.head) content = flow(ink([...pre, ...main]), sp.head, 'center', false, family) + flow(rest, sp.body, align, !!sp.rows, family);
  else content = flow([...pre, ...main, ...rest], sp.body, align, !!sp.rows, family);
  const q = c.qrSize, pad = 8;
  const qr = qrValue ? `<rect x="${w / 2 - q / 2 - pad}" y="${h - q - 40 - pad}" width="${q + 2 * pad}" height="${q + 2 * pad}" rx="6" fill="#ffffff"/>${qrSvg(qrValue).replace('width="512" height="512"', `x="${w / 2 - q / 2}" y="${h - q - 40}" width="${q}" height="${q}"`)}<text x="${w / 2}" y="${h - 29}" text-anchor="middle" direction="rtl" fill="${d.foreground}" font-family="Arial, sans-serif" font-size="11">امسح لفتح الدعوة</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 600 ${h}" role="img" aria-label="${escape(d.title || 'دعوة')}"><rect width="600" height="${h}" fill="${d.background}"/>${d.image ? `<image href="${escape(d.image)}" width="600" height="${h}" preserveAspectRatio="xMidYMid slice" opacity="${d.imageOpacity}"/>` : ''}${sp.ornament}<g color="${d.foreground}">${content}</g>${qr}</svg>`;
}
