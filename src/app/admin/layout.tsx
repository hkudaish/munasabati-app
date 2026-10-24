import Link from 'next/link';
import { requireAdmin } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try { await requireAdmin(); } catch { return <div dir="rtl" className="p-12 text-center space-y-3"><h1 className="text-xl font-bold">لوحة الإدارة</h1><p>يلزم تسجيل الدخول بحساب إداري مصرح له.</p><Link href="/" className="underline">الرئيسية</Link></div>; }
  return children;
}
