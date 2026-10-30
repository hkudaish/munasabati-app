import ExceptionsHome from '@/components/exceptions/ExceptionsHome';
import ExceptionSettings from '@/components/exceptions/ExceptionSettings';
export const dynamic = 'force-dynamic';
// The administrators' view: the whole queue, plus the escalation settings and who works it.
export default function AdminExceptionsPage() {
  return <><ExceptionsHome admin /><div className="mx-auto max-w-6xl px-4 pb-10 sm:px-8"><ExceptionSettings /></div></>;
}
