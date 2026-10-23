'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing } from 'lucide-react';
import { requestJSON } from '@/lib/api-client';

/** Administrators, supervisors, coordinators and vendors: the number of things that need attention, kept fresh while the page is open. */
export default function RemindersBell() {
  const [counts, setCounts] = useState<{ critical: number; total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => requestJSON('/api/reminders').then(r => { if (alive) setCounts(r.counts); }).catch(() => {});
    void load(); const timer = setInterval(load, 60000); window.addEventListener('focus', load);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, []);
  if (!counts) return null;
  return (
    <Link href="/reminders" aria-label={`التنبيهات: ${counts.total}${counts.critical ? `، منها ${counts.critical} عاجل` : ''}`} title="تنبيهات العمل" className="relative flex items-center rounded-xl border border-saudi-sand-300 bg-white p-2 text-saudi-green-900 hover:bg-saudi-sand-100">
      <BellRing className="h-4 w-4" aria-hidden="true" />
      {counts.total > 0 && <span className={`absolute -top-1.5 -start-1.5 min-w-[1.1rem] rounded-full px-1 text-center text-caption2 font-bold text-white ${counts.critical ? 'bg-red-600' : 'bg-saudi-green-800'}`}>{counts.total > 99 ? '99+' : counts.total}</span>}
    </Link>
  );
}
