'use client';
import { useState } from 'react';
import { useApp } from '@/lib/store';
import PackageBuilder from '@/components/commerce/pricing/PackageBuilder';
import RulesPanel from '@/components/commerce/pricing/RulesPanel';
import HistoryPanel from '@/components/commerce/pricing/HistoryPanel';
import SettlementPanel from '@/components/commerce/pricing/SettlementPanel';

const TABS: [string, string][] = [['packages', 'منشئ الباقات والتسعير'], ['rules', 'قواعد الخصم والحملات'], ['history', 'السجل والجدولة'], ['settlement', 'تسوية الخصومات']];

/** One place for administrators, supervisors and vendors to price services and packages. What each can do is decided by the server. */
export default function PricingPage() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState('packages'), [rulePackage, setRulePackage] = useState('');
  if (!currentUser) return <div dir="rtl" className="mx-auto max-w-3xl p-8">سجّل الدخول للوصول إلى إدارة التسعير.</div>;
  if (currentUser.role === 'client') return <div dir="rtl" className="mx-auto max-w-3xl p-8">هذه الصفحة للإدارة والموردين.</div>;
  const isAdmin = currentUser.role === 'admin';
  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      <header><h1 className="font-cairo text-2xl font-black text-saudi-green-950">إدارة التسعير والباقات</h1><p className="text-sm text-gray-600">أنشئ الخدمة مرة واحدة وبعها منفردة أو ضمن باقات، وحدّد سعر الباقة وخصوماتها وجدول تغيّراتها، وعاين السعر كما يراه العميل قبل النشر.</p></header>
      <nav className="flex flex-wrap gap-2" aria-label="أقسام التسعير">{TABS.filter(t => isAdmin || t[0] !== 'settlement' || true).map(([key, label]) => <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`rounded-xl border px-4 py-2 text-sm font-bold ${tab === key ? 'border-saudi-green-800 bg-saudi-green-800 text-white' : 'border-saudi-sand-300 bg-white'}`}>{label}</button>)}</nav>
      {tab === 'packages' && <PackageBuilder isAdmin={isAdmin} openRules={id => { setRulePackage(id); setTab('rules'); }} />}
      {tab === 'rules' && <RulesPanel isAdmin={isAdmin} startPackage={rulePackage} />}
      {tab === 'history' && <HistoryPanel />}
      {tab === 'settlement' && <SettlementPanel />}
    </div>
  );
}
