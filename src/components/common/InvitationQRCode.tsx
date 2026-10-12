'use client';

import { useMemo } from 'react';
import { qrSvg } from '@/lib/invitations/qr';

export default function InvitationQRCode({ value, className = 'w-48 h-48' }: { value: string; className?: string }) {
  const result = useMemo(() => {
    if (!value) return { svg: '', error: '' };
    try { return { svg: qrSvg(value), error: '' }; }
    catch { return { svg: '', error: 'تعذر إنشاء QR؛ اختصر نصوص الدعوة أو تحقق من الرابط.' }; }
  }, [value]);
  if (result.error) return <p role="alert" className="text-xs text-red-700">{result.error}</p>;
  if (!result.svg) return <p role="status" className="text-xs text-gray-500">جارٍ تجهيز QR…</p>;
  return <div className={`${className} bg-white [&_svg]:w-full [&_svg]:h-full`} dangerouslySetInnerHTML={{ __html: result.svg }} />;
}
