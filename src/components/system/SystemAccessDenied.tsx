'use client';
import { useApp } from '@/lib/store';
export default function SystemAccessDenied() {
  const { currentUser, openOnboarding } = useApp();
  return <div dir="rtl" className="max-w-xl mx-auto p-12 text-center space-y-4"><h1 className="text-xl font-bold">لوحة مدير النظام</h1><p>هذه اللوحة مخصصة لمدير النظام المصرح له، وهي مستقلة عن لوحة الإدارة.</p>{!currentUser && <button onClick={() => openOnboarding()} className="rounded-xl bg-saudi-green-900 text-white px-5 py-2">تسجيل الدخول</button>}<a href="/" className="block underline">العودة للرئيسية</a></div>;
}
