'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { NOTIFY_EVENT, type NotifyKind } from '@/lib/notify';
import { useT } from '@/components/i18n/LocaleProvider';

type Toast = { id: number; message: string; kind: NotifyKind };

const tone: Record<NotifyKind, string> = {
  error: 'border-red-300 bg-red-50 text-red-900',
  success: 'border-saudi-green-300 bg-saudi-green-50 text-saudi-green-900',
  info: 'border-saudi-sand-300 bg-white text-slate-900',
};

export default function Toaster() {
  const tr = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let next = 0;
    const onNotify = (e: Event) => {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: NotifyKind }>).detail;
      const id = ++next;
      setToasts(t => [...t.slice(-2), { id, message, kind }]);
      // Errors stay until dismissed so they can be read at any text size.
      if (kind !== 'error') window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
    };
    window.addEventListener(NOTIFY_EVENT, onNotify);
    return () => window.removeEventListener(NOTIFY_EVENT, onNotify);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-card ${tone[t.kind]}`}
        >
          <p className="flex-1 leading-relaxed">{t.message}</p>
          <button
            type="button"
            aria-label={tr('إغلاق')}
            onClick={() => setToasts(x => x.filter(i => i.id !== t.id))}
            className="shrink-0 rounded-lg p-1 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
