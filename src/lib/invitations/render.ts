import { qrSvg } from './qr';
import { CardDesign, SIZES } from './catalog';
import { escape, layoutSvg, wrap } from './layouts';
export function cardSvg(d: CardDesign, qrValue = ''): string {
  if (d.layout && d.layout !== 'classic') return layoutSvg(d, qrValue);
  const size = SIZES[d.size], h = 600 * size.height / size.width;
  const center = h / 2, x = d.align === 'right' ? 510 : 300;
  const anchor = d.align === 'right' ? 'end' : 'middle';
  const text = (s: string, y: number, fontSize: number, color = d.foreground, bold = false, count = 40) => {
    const lines = wrap(s, count);
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" direction="rtl" unicode-bidi="plaintext" fill="${color}" font-size="${fontSize}" font-weight="${bold ? 700 : 400}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? fontSize * 1.55 : 0}">${escape(line)}</tspan>`).join('')}</text>`;
  };
  let decoration = '';
  if (d.motif === 'arch') decoration = `<path d="M65 ${h - 55} V260 A235 205 0 0 1 535 260 V${h - 55}" fill="none" stroke="${d.accent}" stroke-width="2"/><path d="M80 ${h - 65} V265 A220 190 0 0 1 520 265 V${h - 65}" fill="none" stroke="${d.accent}" opacity=".35"/>`;
  if (d.motif === 'botanical') {
    for (const [tx, ty, angle] of [[45, 45, 0], [555, h - 45, 180]]) {
      decoration += `<g transform="translate(${tx} ${ty}) rotate(${angle})" stroke="${d.accent}" fill="${d.accent}"><path d="M0 150 Q90 70 150 0" fill="none" stroke-width="2"/>${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${20 + i * 20}" cy="${130 - i * 20}" rx="12" ry="28" transform="rotate(-45 ${20 + i * 20} ${130 - i * 20})" opacity=".3"/><ellipse cx="${40 + i * 18}" cy="${140 - i * 20}" rx="10" ry="25" transform="rotate(35 ${40 + i * 18} ${140 - i * 20})" opacity=".4"/>`).join('')}</g>`;
    }
  }
  if (d.motif === 'stars' || d.motif === 'confetti') {
    decoration = Array.from({ length: 32 }, (_, i) => {
      const px = 35 + (i * 137 % 530), py = i < 16 ? 35 + (i * 37 % 120) : h - 160 + (i * 43 % 120);
      return d.motif === 'stars' ? `<path d="M${px} ${py - 8} l3 6 7 2 -7 3 -3 7 -3 -7 -7 -3 7 -2Z" fill="${d.accent}" opacity=".6"/>` : `<rect x="${px}" y="${py}" width="6" height="15" rx="2" fill="${i % 2 ? d.accent : d.foreground}" opacity=".35" transform="rotate(${i * 29} ${px} ${py})"/>`;
    }).join('');
  }
  if (d.motif === 'geometric') decoration = `<g fill="none" stroke="${d.accent}" opacity=".65">${[0, 1, 2].map(i => `<path d="M${25 + i * 12} 175 V${25 + i * 12} H175 M425 ${h - 25 - i * 12} H${575 - i * 12} V${h - 175}"/>`).join('')}<path d="M300 65 l30 30 -30 30 -30 -30Z"/></g>`;
  const titleLines = wrap(d.title, Math.max(14, Math.floor(780 / d.titleSize))).length;
  const openingLines = wrap(d.opening, 40).length;
  const titleY = center - 65;
  const detailsY = titleY + Math.max(1, titleLines) * d.titleSize * 1.55 + 35;
  const venueLines = wrap(d.venue, 38).length;
  const dateText = [d.date, d.time].filter(Boolean).join('  ·  ');
  const dateExtra = Math.max(0, wrap(dateText, 40).length - 1) * 28;
  const venueY = detailsY + 58 + dateExtra;
  const closingY = venueY + 42 + Math.max(0, venueLines - 1) * 28;
  const badgeY = titleY - openingLines * 29 - 75;
  const bottom = closingY + Math.max(1, wrap(d.closing, 40).length) * 24;
  const top = badgeY - 20;
  const qrReserve = qrValue ? 215 : 0;
  const scale = Math.min(1, (h - qrReserve - 190) / (bottom - top));
  const halfHeight = (bottom - top) * scale / 2;
  const targetCenter = Math.max(95 + halfHeight, Math.min(h - qrReserve - 95 - halfHeight, (h - qrReserve) / 2 + d.offset));
  const transform = `translate(${x * (1 - scale)} ${targetCenter}) scale(${scale}) translate(0 ${-(top + bottom) / 2})`;
  const qr = qrValue ? qrSvg(qrValue).replace('width="512" height="512"', `x="210" y="${h - 215}" width="180" height="180"`) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 600 ${h}" role="img" aria-label="${escape(d.title)}"><rect width="600" height="${h}" fill="${d.background}"/>${d.image ? `<image href="${escape(d.image)}" width="600" height="${h}" preserveAspectRatio="xMidYMid slice" opacity="${d.imageOpacity}"/>` : ''}<rect x="25" y="25" width="550" height="${h - 50}" rx="5" fill="none" stroke="${d.accent}" opacity=".3"/>${decoration}<g transform="${transform}" font-family="${d.font === 'serif' ? 'Georgia, Times New Roman, serif' : 'Arial, sans-serif'}">${text('دعوة خاصة', badgeY, 15, d.accent, true)}${text(d.opening, titleY - openingLines * 29 - 28, 18)}${text(d.title, titleY, d.titleSize, d.accent, true, Math.max(14, Math.floor(780 / d.titleSize)))}<path d="M240 ${detailsY - 12} H360" stroke="${d.accent}" opacity=".5"/>${text(dateText, detailsY + 20, 18)}${text(d.venue, venueY, 18, d.foreground, false, 38)}${text(d.closing, closingY, 15)}</g>${qr}${qrValue ? `<text x="300" y="${h - 18}" text-anchor="middle" direction="rtl" fill="${d.foreground}" font-family="Arial, sans-serif" font-size="11">امسح لفتح الدعوة</text>` : ''}</svg>`;
}
export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function pngBlob(design: CardDesign, qrValue = ''): Promise<Blob> {
  await document.fonts.ready;
  const url = URL.createObjectURL(new Blob([cardSvg(design, qrValue)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('تعذر تجهيز الصورة')); img.src = url; });
    const { width, height } = SIZES[design.size];
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('التصدير غير مدعوم في هذا المتصفح');
    context.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('تعذر تصدير الصورة')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
export function printCard(design: CardDesign, qrValue = '') {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('اسمح بفتح نافذة الطباعة في المتصفح');
  const size = SIZES[design.size];
  const width = 148;
  const height = width * size.height / size.width;
  popup.document.write(`<!doctype html><html lang="ar"><head><title>بطاقة دعوة</title><style>@page{size:${width}mm ${height}mm;margin:0}html,body{margin:0}svg{width:${width}mm;height:${height}mm;display:block}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>${cardSvg(design, qrValue)}</body></html>`);
  popup.document.close();
  Promise.all([popup.document.fonts.ready, ...Array.from(popup.document.images).map(img => img.decode().catch(() => {}))]).then(() => { popup.focus(); popup.print(); });
}
