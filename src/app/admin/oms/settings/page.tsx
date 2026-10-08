'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  ShieldCheck,
  Save,
  RotateCcw,
  Sliders,
  Clock,
  Bell,
  AlertTriangle,
  Layers,
  ArrowRight,
  CheckCircle,
  Activity,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import type { OMSSettings } from '@/lib/oms/types';

export default function OMSAutomationSettingsPage() {
  const [settings, setSettings] = useState<OMSSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/oms/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/oms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, actorUserId: 'admin_user' }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage('تم حفظ وتحديث قواعد وإعدادات الأتمتة بنجاح');
        setSettings(data.settings);
      } else {
        alert(data.errorAr || 'فشل حفظ الإعدادات');
      }
    } catch (e) {
      alert('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setSaving(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">جاري تحميل إعدادات محرك الأتمتة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 left-6 z-50 bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/oms"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">إعدادات إدارة الطلبات والأتمتة</h1>
              <p className="text-xs md:text-sm text-slate-400">لوحة التحكم الديناميكية بقواعد التشغيل والمهل وأوزان التوجيه (Rules Engine)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSettings}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-800 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة تحميل</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ وتطبيق القواعد'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-6">
        {/* Section 1: Routing Weights */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">أوزان التوجيه الآلي للموردين</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            يحدد المحرك المورد الأنسب للطلب آلياً بناءً على الأوزان النسبية التالية:
          </p>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>التوفر والجاهزية:</span>
                <span className="font-bold text-amber-400">{settings.routingWeights.availabilityWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={settings.routingWeights.availabilityWeight}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    routingWeights: { ...settings.routingWeights, availabilityWeight: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>سرعة استجابة المورد:</span>
                <span className="font-bold text-amber-400">{settings.routingWeights.responseTimeWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={settings.routingWeights.responseTimeWeight}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    routingWeights: { ...settings.routingWeights, responseTimeWeight: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>نسبة الالتزام بمواعيد SLA:</span>
                <span className="font-bold text-amber-400">{settings.routingWeights.onTimeRateWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={settings.routingWeights.onTimeRateWeight}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    routingWeights: { ...settings.routingWeights, onTimeRateWeight: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>تقييمات العملاء والجودة:</span>
                <span className="font-bold text-amber-400">{settings.routingWeights.ratingWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={settings.routingWeights.ratingWeight}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    routingWeights: { ...settings.routingWeights, ratingWeight: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: SLA & Timeouts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">مهل اتفاقيات الخدمة (SLA)</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1">مهلة قبول المورد للطلب (بالدقائق):</label>
              <input
                type="number"
                value={settings.acceptanceDeadlineMinutes}
                onChange={(e) => setSettings({ ...settings, acceptanceDeadlineMinutes: parseInt(e.target.value) || 60 })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:border-amber-500 outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">مهلة مراجعة واعتماد العميل (بالساعات):</label>
              <input
                type="number"
                value={settings.customerReviewDeadlineHours}
                onChange={(e) => setSettings({ ...settings, customerReviewDeadlineHours: parseInt(e.target.value) || 24 })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:border-amber-500 outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">حد أقصى لعدم النشاط قبل التنبيه (بالساعات):</label>
              <input
                type="number"
                value={settings.maxInactivityHours}
                onChange={(e) => setSettings({ ...settings, maxInactivityHours: parseInt(e.target.value) || 12 })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:border-amber-500 outline-none font-bold"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Alerts & Escalation Policy */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <Bell className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-white text-base">سياسات التنبيه والتصعيد الآلي</h3>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <span className="text-slate-300">تنبيه 50% من المهلة (تذكير داخلي)</span>
              <input
                type="checkbox"
                checked={settings.alert50PercentEnabled}
                onChange={(e) => setSettings({ ...settings, alert50PercentEnabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <span className="text-slate-300">تنبيه 75% من المهلة (إنذار المورد)</span>
              <input
                type="checkbox"
                checked={settings.alert75PercentEnabled}
                onChange={(e) => setSettings({ ...settings, alert75PercentEnabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <span className="text-slate-300">تنبيه 90% من المهلة (عاجل للعمليات والمورد)</span>
              <input
                type="checkbox"
                checked={settings.alert90PercentEnabled}
                onChange={(e) => setSettings({ ...settings, alert90PercentEnabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <span className="text-slate-300">إعادة إسناد آلي عند انتهاء مهلة القبول</span>
              <input
                type="checkbox"
                checked={settings.autoReassignOnTimeout}
                onChange={(e) => setSettings({ ...settings, autoReassignOnTimeout: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
