'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  Store,
  Settings,
  Layers,
  CheckCircle2,
  XCircle,
  Sparkles,
  Award,
  AlertTriangle,
  Building,
  Clock,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import { Vendor } from '@/lib/types';

export default function AdminDashboardPage() {
  const {
    adminConfig,
    updateAdminConfig,
    occasionTypes,
    serviceCategories,
    vendors,
    updateVendorStatus,
    bookings,
    cities,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'kpis' | 'vendors' | 'occasions' | 'settings'>('kpis');

  // Platform Settings State
  const [platformName, setPlatformName] = useState(adminConfig.platformNameAr);
  const [tagline, setTagline] = useState(adminConfig.taglineAr);
  const [commission, setCommission] = useState(adminConfig.commissionRatePercent.toString());
  const [aiName, setAiName] = useState(adminConfig.aiAssistantNameAr);
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateAdminConfig({
      platformNameAr: platformName,
      taglineAr: tagline,
      commissionRatePercent: Number(commission) || 10,
      aiAssistantNameAr: aiName,
    });
    setSavedSettingsSuccess(true);
    setTimeout(() => setSavedSettingsSuccess(false), 2000);
  };

  const platformRevenue = Math.round((adminConfig.totalGMV * adminConfig.commissionRatePercent) / 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-saudi-gold-600">
            <ShieldCheck className="w-4 h-4" />
            <span>لوحة القيادة والتحكم العام للمنصة (Super Admin)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
            لوحة الإدارة التنفيذية 🇸🇦
          </h1>
          <p className="text-xs text-gray-500 font-tajawal">
            إدارة المنظومة بالكامل: حجم التداولات (GMV)، توثيق الموردين، تهيئة المناسبات والتصنيفات، والعمولات.
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GMV */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>حجم التداولات الإجمالي (GMV)</span>
            <TrendingUp className="w-4 h-4 text-saudi-green-800" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-green-950 block">
            {formatSAR(adminConfig.totalGMV)}
          </span>
          <span className="text-[11px] text-green-700 font-semibold block">+24% نمو ربع سنوي</span>
        </div>

        {/* Platform Net Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>صافي إيرادات العمولات ({adminConfig.commissionRatePercent}%)</span>
            <DollarSign className="w-4 h-4 text-saudi-gold-600" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-gold-700 block">
            {formatSAR(platformRevenue)}
          </span>
          <span className="text-[11px] text-gray-400 block">عمولة حجوزات المنصة</span>
        </div>

        {/* Total Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>إجمالي الحجوزات المنفذة</span>
            <CheckCircle2 className="w-4 h-4 text-saudi-green-800" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-green-950 block">
            {adminConfig.totalBookings.toLocaleString('ar-SA')} حجز
          </span>
          <span className="text-[11px] text-gray-400 block">متوسط الحجز: 3,450 ر.س</span>
        </div>

        {/* Active Users & Vendors */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>المستخدمين والموردين</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-black font-cairo text-gray-900 block">
            {adminConfig.totalUsers.toLocaleString('ar-SA')} عميل
          </span>
          <span className="text-[11px] text-saudi-green-800 font-bold block">
            {adminConfig.totalVendors} مورد معتمد بالمملكة
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-saudi-sand-300 flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:text-sm font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('kpis')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'kpis'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-saudi-gold-600" />
          <span>مؤشرات الأداء وتحليلات المدن</span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'vendors'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Store className="w-4 h-4 text-saudi-gold-600" />
          <span>توثيق واعتماد الموردين ({vendors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('occasions')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'occasions'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4 text-saudi-gold-600" />
          <span>المناسبات والتصنيفات الديناميكية ({occasionTypes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4 text-saudi-gold-600" />
          <span>إعدادات التطبيق والعمولات</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {/* KPIs Tab */}
        {activeTab === 'kpis' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Cities */}
            <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
              <h4 className="text-base font-bold text-gray-900 font-cairo">
                أعلى المدن في حجم التداولات والحجوزات 🇸🇦
              </h4>
              <div className="space-y-3">
                {[
                  { city: 'الرياض', share: '48%', gmv: 2328000 },
                  { city: 'جدة', share: '26%', gmv: 1261000 },
                  { city: 'الخبر والدمام', share: '15%', gmv: 727500 },
                  { city: 'مكة المكرمة والمدينة', share: '7%', gmv: 339500 },
                  { city: 'باقي المدن (الأحساء، أبها، تبوك)', share: '4%', gmv: 194000 },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between font-bold text-gray-800">
                      <span>{item.city}</span>
                      <span className="text-saudi-green-900">{formatSAR(item.gmv)} ({item.share})</span>
                    </div>
                    <div className="w-full bg-saudi-sand-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-saudi-green-800 h-full" style={{ width: item.share }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Occasion Types */}
            <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
              <h4 className="text-base font-bold text-gray-900 font-cairo">
                أكثر أنواع المناسبات طلباً
              </h4>
              <div className="space-y-3">
                {[
                  { type: 'حفلات التخرج والتفوق', count: 1240, percentage: '38%' },
                  { type: 'عقد قران وملكة', count: 860, percentage: '26%' },
                  { type: 'حفلات زفاف وأعراس', count: 520, percentage: '16%' },
                  { type: 'استقبال مولود جديد', count: 410, percentage: '13%' },
                  { type: 'أعياد ميلاد ومناسبات خاصة', count: 210, percentage: '7%' },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between font-bold text-gray-800">
                      <span>{item.type}</span>
                      <span className="text-saudi-gold-700">{item.count} مناسبة ({item.percentage})</span>
                    </div>
                    <div className="w-full bg-saudi-sand-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-saudi-gold-500 h-full" style={{ width: item.percentage }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-saudi-sand-300 flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-900 font-cairo">
                إدارة الموردين وطلبات التوثيق بالسجلات الرسمية
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-saudi-sand-100 text-gray-600 font-bold border-b border-saudi-sand-300">
                  <tr>
                    <th className="p-3.5">اسم المنشأة</th>
                    <th className="p-3.5">المدينة والتصنيف</th>
                    <th className="p-3.5">السجل التجاري / العمل الحر</th>
                    <th className="p-3.5">التقييم</th>
                    <th className="p-3.5">حالة التوثيق</th>
                    <th className="p-3.5 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-saudi-sand-50/60 transition">
                      <td className="p-3.5 font-bold text-gray-900 flex items-center gap-2">
                        <img src={v.logo} alt={v.businessName} className="w-7 h-7 rounded-lg object-cover" />
                        <span>{v.businessName}</span>
                      </td>
                      <td className="p-3.5 text-gray-600">{v.cityNameAr} • {v.categoryNameAr}</td>
                      <td className="p-3.5 font-mono text-gray-700 font-semibold">
                        {v.crNumber || v.freelanceLicense || 'قيد الرفع'}
                      </td>
                      <td className="p-3.5 font-bold text-saudi-gold-700">{v.rating} ⭐</td>
                      <td className="p-3.5">
                        {v.verified ? (
                          <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            موثق ومعتمد
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            بانتظار المراجعة
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => updateVendorStatus(v.id, 'active', !v.verified)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                            v.verified
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-saudi-green-800 text-white hover:bg-saudi-green-900'
                          }`}
                        >
                          {v.verified ? 'إلغاء التوثيق' : 'اعتماد وتوثيق 🇸🇦'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Occasions Dynamic Config Tab */}
        {activeTab === 'occasions' && (
          <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
            <h4 className="text-base font-bold text-gray-900 font-cairo">
              أنواع المناسبات والتصنيفات المدعومة في المنصة (Database-Driven)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {occasionTypes.map((occ) => (
                <div key={occ.id} className="p-3.5 bg-saudi-sand-50 rounded-2xl border border-saudi-sand-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-900">{occ.nameAr}</span>
                    <span className="text-[10px] font-mono text-gray-400">{occ.id}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 line-clamp-1">{occ.descriptionAr}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-sm space-y-6 max-w-2xl">
            <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
              <Settings className="w-5 h-5 text-saudi-green-800" />
              <span>إعدادات وهوية المنصة القابلة للتخصيص</span>
            </h4>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  اسم التطبيق والمنصة (Working Product Name)
                </label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  الشعار اللفظي للمنصة (Tagline)
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    نسبة عمولة المنصة (%)
                  </label>
                  <input
                    type="number"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    اسم المساعد الذكي
                  </label>
                  <input
                    type="text"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                {savedSettingsSuccess ? (
                  <span className="text-xs font-bold text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    تم حفظ وتحديث إعدادات المنصة بنجاح!
                  </span>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
