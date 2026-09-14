'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  Layers,
  ShoppingBag,
  Gift,
  FileText,
  Armchair,
  MailCheck,
  UserCheck,
  AlertCircle,
  Share2,
  Edit3,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR, getDaysRemaining } from '@/lib/utils';
import BudgetManager from '@/components/occasion/BudgetManager';
import GuestManager from '@/components/occasion/GuestManager';
import TableSeatingPlanner from '@/components/occasion/TableSeatingPlanner';
import DigitalInviteGenerator from '@/components/occasion/DigitalInviteGenerator';
import TasksTimeline from '@/components/occasion/TasksTimeline';
import WishlistManager from '@/components/occasion/WishlistManager';

type TabType =
  | 'overview'
  | 'budget'
  | 'guests'
  | 'tables'
  | 'invitations'
  | 'tasks'
  | 'wishlist'
  | 'bookings';

export default function OccasionWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const {
    occasions,
    budgetItems,
    guests,
    tasks,
    bookings,
    updateOccasion,
    setActiveOccasionId,
  } = useApp();

  const occasionId = params.id as string;
  const currentOccasion = occasions.find((o) => o.id === occasionId) || occasions[0];

  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (!currentOccasion) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">المناسبة غير موجودة</h2>
        <Link href="/" className="inline-block px-5 py-2.5 bg-saudi-green-800 text-white rounded-xl text-xs font-bold">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  const occasionBudgetItems = budgetItems.filter((b) => b.occasionId === currentOccasion.id);
  const occasionGuests = guests.filter((g) => g.occasionId === currentOccasion.id);
  const occasionTasks = tasks.filter((t) => t.occasionId === currentOccasion.id);
  const occasionBookings = bookings.filter((b) => b.occasionId === currentOccasion.id);

  const totalSpent = occasionBudgetItems.reduce((acc, curr) => acc + curr.spentAmount, 0);
  const confirmedGuestsCount = occasionGuests.filter((g) => g.status === 'confirmed').length;
  const completedTasksCount = occasionTasks.filter((t) => t.isCompleted).length;
  const daysRemaining = getDaysRemaining(currentOccasion.date);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* 1. Occasion Header Banner */}
      <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-saudi-gold-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-saudi-gold-500/20 text-saudi-gold-300 font-bold px-3 py-1 rounded-full border border-saudi-gold-400/40">
                {currentOccasion.occasionTypeNameAr}
              </span>
              <span className="bg-white/10 text-gray-200 px-3 py-1 rounded-full flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-saudi-gold-400" />
                {currentOccasion.cityNameAr} • {currentOccasion.neighborhood || 'الرياض'}
              </span>
              <span className="bg-white/10 text-gray-200 px-3 py-1 rounded-full flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-saudi-gold-400" />
                {currentOccasion.date}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-cairo text-white">
              {currentOccasion.title}
            </h1>
            <p className="text-xs text-saudi-sand-200 leading-relaxed font-tajawal">
              {currentOccasion.notes || 'مساحة العمل المركزية لتنظيم كافة المشتريات والحجوزات والمدعوين.'}
            </p>
          </div>

          {/* Readiness Gauge & Countdown */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 self-start lg:self-auto shrink-0">
            {/* Readiness percentage dial */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/20"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-saudi-gold-400 transition-all duration-700"
                  strokeDasharray={`${currentOccasion.readinessPercentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black font-cairo text-saudi-gold-300">
                {currentOccasion.readinessPercentage}%
              </span>
            </div>

            <div className="space-y-0.5 text-xs">
              <span className="text-saudi-gold-300 font-bold block">جاهزية المناسبة</span>
              <span className="text-gray-300 block text-[11px]">
                {daysRemaining > 0 ? `متبقي ${daysRemaining} يوماً على الموعد` : 'موعد المناسبة اليوم! 🎉'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Quick Access Bar */}
        <div className="pt-6 mt-6 border-t border-white/10 flex flex-wrap items-center gap-3 text-xs">
          <Link
            href="/marketplace"
            className="bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 px-4 py-2 rounded-xl font-bold shadow-md flex items-center gap-1.5 transition"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>حجز خدمات وباقات</span>
          </Link>

          <Link
            href="/rfq"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5 text-saudi-gold-300" />
            <span>اطلب عروض أسعار (RFQ)</span>
          </Link>

          <button
            onClick={() => setActiveTab('invitations')}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition"
          >
            <MailCheck className="w-3.5 h-3.5 text-saudi-gold-300" />
            <span>إرسال وتخصيص الدعوات</span>
          </button>
        </div>
      </div>

      {/* 2. Workspace Navigation Tabs */}
      <div className="border-b border-saudi-sand-300 flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:text-sm font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4 text-saudi-gold-600" />
          <span>نظرة عامة</span>
        </button>

        <button
          onClick={() => setActiveTab('budget')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'budget'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-saudi-gold-600" />
          <span>الميزانية ({formatSAR(currentOccasion.budget)})</span>
        </button>

        <button
          onClick={() => setActiveTab('guests')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'guests'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4 text-saudi-gold-600" />
          <span>المدعوين و RSVP ({occasionGuests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tables')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'tables'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Armchair className="w-4 h-4 text-saudi-gold-600" />
          <span>مخطط الطاولات</span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'invitations'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <MailCheck className="w-4 h-4 text-saudi-gold-600" />
          <span>الدعوات وبطاقة QR</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4 text-saudi-gold-600" />
          <span>الجدول والمهام ({completedTasksCount}/{occasionTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('wishlist')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'wishlist'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Gift className="w-4 h-4 text-saudi-gold-600" />
          <span>قائمة الهدايا</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'bookings'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-saudi-gold-600" />
          <span>حجوزاتي والفواتير ({occasionBookings.length})</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setActiveTab('budget')}
                className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm cursor-pointer hover:border-saudi-gold-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">الميزانية والمصروف</span>
                  <DollarSign className="w-4 h-4 text-saudi-gold-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-cairo text-saudi-green-950">
                    {formatSAR(totalSpent)}
                  </span>
                  <span className="text-xs text-gray-400">من {formatSAR(currentOccasion.budget)}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-saudi-gold-500 h-full"
                    style={{ width: `${Math.min(100, (totalSpent / currentOccasion.budget) * 100)}%` }}
                  />
                </div>
              </div>

              <div
                onClick={() => setActiveTab('guests')}
                className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm cursor-pointer hover:border-saudi-gold-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">تأكيد حضور المدعوين</span>
                  <Users className="w-4 h-4 text-saudi-green-700" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-cairo text-green-700">
                    {confirmedGuestsCount} مؤكد
                  </span>
                  <span className="text-xs text-gray-400">من {occasionGuests.length} مسجل</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-green-600 h-full"
                    style={{ width: `${occasionGuests.length > 0 ? (confirmedGuestsCount / occasionGuests.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div
                onClick={() => setActiveTab('tasks')}
                className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm cursor-pointer hover:border-saudi-gold-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">المهام المنجزة</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-cairo text-saudi-green-950">
                    {completedTasksCount} مهمة
                  </span>
                  <span className="text-xs text-gray-400">من {occasionTasks.length} متبقية</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full"
                    style={{ width: `${occasionTasks.length > 0 ? (completedTasksCount / occasionTasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div
                onClick={() => setActiveTab('bookings')}
                className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm cursor-pointer hover:border-saudi-gold-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">الحجوزات النشطة</span>
                  <ShieldCheck className="w-4 h-4 text-saudi-gold-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-cairo text-saudi-green-900">
                    {occasionBookings.length} حجوزات
                  </span>
                  <span className="text-xs text-green-700 font-bold">مؤكدة بالعربون</span>
                </div>
                <span className="text-[10px] text-gray-400 mt-2 block">
                  عقود إلكترونية محمية بالكامل
                </span>
              </div>
            </div>

            {/* Active Bookings Summary */}
            <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-saudi-green-800" />
                  <span>حجوزات المناسبة المعتمدة ({occasionBookings.length})</span>
                </h4>
                <Link
                  href="/marketplace"
                  className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
                >
                  <span>+ حجز خدمة جديدة</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {occasionBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl border border-saudi-sand-300 bg-saudi-sand-50/50 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-gray-400 block font-bold">{b.bookingNumber}</span>
                      <h5 className="font-bold text-xs text-gray-900">{b.serviceTitleAr}</h5>
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        المزود: <strong className="text-saudi-green-900">{b.vendorName}</strong>
                      </span>
                      <div className="pt-2 flex items-center gap-2 text-[11px]">
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">
                          تم سداد العربون ({formatSAR(b.depositAmount)})
                        </span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-xs text-gray-400 block">الإجمالي:</span>
                      <span className="text-sm font-black font-cairo text-saudi-green-950">
                        {formatSAR(b.totalAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Step Advice */}
            <div className="bg-gradient-to-r from-saudi-gold-50 to-amber-50 border border-saudi-gold-300 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-right">
                <h5 className="font-bold text-sm text-saudi-green-950 flex items-center justify-center sm:justify-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-saudi-gold-600" />
                  <span>الخطوة التالية الموصى بها لمناسبتك:</span>
                </h5>
                <p className="text-xs text-gray-600">
                  قم بإرسال بطاقات الدعوة الرقمية إلى المدعوات عبر الواتساب لتأكيد الحضور وتوزيع الطاولات.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('invitations')}
                className="px-6 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs shrink-0 shadow-sm transition"
              >
                الانتقال لمركز الدعوات
              </button>
            </div>
          </div>
        )}

        {activeTab === 'budget' && <BudgetManager />}
        {activeTab === 'guests' && <GuestManager />}
        {activeTab === 'tables' && <TableSeatingPlanner />}
        {activeTab === 'invitations' && <DigitalInviteGenerator />}
        {activeTab === 'tasks' && <TasksTimeline />}
        {activeTab === 'wishlist' && <WishlistManager />}

        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-900 font-cairo">
                حجوزات وعقود المناسبة ({occasionBookings.length})
              </h4>
              <Link
                href="/marketplace"
                className="px-4 py-2 bg-saudi-green-800 text-white rounded-xl text-xs font-bold"
              >
                + حجز خدمة إضافية
              </Link>
            </div>

            <div className="space-y-4">
              {occasionBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl p-6 border border-saudi-sand-300 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-saudi-gold-600 font-mono">
                        رقم العقد: {b.bookingNumber}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900">{b.serviceTitleAr}</h4>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                      حجز مؤكد ومحمي
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-gray-600">
                    <div>
                      <span className="text-gray-400 block">المزود المعتمد:</span>
                      <strong className="text-gray-900">{b.vendorName}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">المبلغ الإجمالي:</span>
                      <strong className="text-saudi-green-950 font-cairo">{formatSAR(b.totalAmount)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">العربون المسدد:</span>
                      <strong className="text-green-700">{formatSAR(b.depositAmount)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">المتبقي عند التنفيذ:</span>
                      <strong className="text-amber-700">{formatSAR(b.remainingAmount)}</strong>
                    </div>
                  </div>

                  <div className="space-y-1 bg-saudi-sand-50 p-3 rounded-xl text-xs">
                    <span className="font-bold text-gray-700 block">المخرجات والالتزامات المتفق عليها:</span>
                    <ul className="list-disc list-inside text-gray-600 space-y-0.5 text-[11px]">
                      {b.deliverablesAr.map((d, idx) => (
                        <li key={idx}>{d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
