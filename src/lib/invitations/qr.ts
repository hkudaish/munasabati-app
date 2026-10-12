import QRCode from 'qrcode';

export function qrSvg(value: string): string {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size, margin = 4;
  const paths: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(y, x)) paths.push(`M${x + margin} ${y + margin}h1v1h-1z`);
    }
  }
  const total = size + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="512" height="512" role="img" aria-label="رمز QR للدعوة" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${paths.join('')}" fill="#000"/></svg>`;
}
