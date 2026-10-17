import { requireSystemAdmin } from '@/lib/server/auth';
import SystemAccessDenied from '@/components/system/SystemAccessDenied';
export const dynamic = 'force-dynamic';
export default async function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  try { await requireSystemAdmin(); } catch { return <SystemAccessDenied />; }
  return children;
}
