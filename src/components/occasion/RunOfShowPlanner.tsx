'use client';

import React, { useState } from 'react';
import { Occasion, RunOfShowItem } from '@/lib/types';
import { useApp } from '@/lib/store';
import { 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  PlayCircle, 
  AlertCircle, 
  Share2, 
  Printer, 
  Sparkles, 
  Camera, 
  Coffee, 
  Music, 
  Utensils, 
  Gift, 
  UserCheck, 
  Phone, 
  MessageSquare,
  X,
  ChevronDown
} from 'lucide-react';

interface RunOfShowPlannerProps {
  occasion: Occasion;
}

export const RunOfShowPlanner: React.FC<RunOfShowPlannerProps> = ({ occasion }) => {
  const { 
    runOfShowItems, 
    addRunOfShowItem, 
    updateRunOfShowItem, 
    deleteRunOfShowItem 
  } = useApp();

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form State for new item
  const [newTime, setNewTime] = useState<string>('20:00');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newRole, setNewRole] = useState<RunOfShowItem['responsibleRole']>('coordinator');
  const [newRoleAr, setNewRoleAr] = useState<string>('منسق الحفل');
  const [newPerson, setNewPerson] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newDuration, setNewDuration] = useState<number>(30);
  const [newNotes, setNewNotes] = useState<string>('');

  const occasionItems = runOfShowItems
    .filter((item) => item.occasionId === occasion.id || item.occasionId === 'occ-demo-1')
    .sort((a, b) => a.time.localeCompare(b.time));

  const filteredItems = occasionItems.filter((item) => {
    if (selectedRoleFilter === 'all') return true;
    return item.responsibleRole === selectedRoleFilter;
  });

  const getIconComponent = (iconName?: string, role?: string) => {
    if (iconName === 'Camera' || role === 'photographer') return <Camera className="w-5 h-5 text-indigo-500" />;
    if (iconName === 'Coffee' || role === 'catering') return <Coffee className="w-5 h-5 text-amber-600" />;
    if (iconName === 'Music' || role === 'music') return <Music className="w-5 h-5 text-purple-500" />;
    if (iconName === 'Utensils') return <Utensils className="w-5 h-5 text-orange-500" />;
    if (iconName === 'Gift') return <Gift className="w-5 h-5 text-pink-500" />;
    if (iconName === 'UserCheck') return <UserCheck className="w-5 h-5 text-emerald-500" />;
    return <Sparkles className="w-5 h-5 text-emerald-500" />;
  };

  const getStatusBadge = (status: RunOfShowItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            اكتملت
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 animate-pulse">
            <PlayCircle className="w-3.5 h-3.5" />
            جارية الآن
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertCircle className="w-3.5 h-3.5" />
            متأخرة
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            <Clock className="w-3.5 h-3.5" />
            قيد الانتظار
          </span>
        );
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addRunOfShowItem({
      occasionId: occasion.id,
      time: newTime,
      titleAr: newTitle,
      descriptionAr: newDescription,
      responsibleRole: newRole,
      responsibleRoleAr: newRoleAr,
      responsiblePerson: newPerson,
      responsiblePhone: newPhone,
      status: 'pending',
      durationMinutes: Number(newDuration) || 30,
      notes: newNotes,
    });

    setIsAddModalOpen(false);
    setNewTitle('');
    setNewDescription('');
    setNewPerson('');
    setNewPhone('');
    setNewNotes('');
  };

  const shareScheduleViaWhatsApp = () => {
    let message = `🇸🇦 *جدول سير فعاليات يوم المناسبة | ${occasion.title}*\n`;
    message += `📅 التاريخ: ${occasion.date}\n📍 المدينة: ${occasion.cityNameAr}\n`;
    message += `──────────────────\n`;

    occasionItems.forEach((item, idx) => {
      const statusIcon = item.status === 'completed' ? '✅' : item.status === 'in_progress' ? '⏳' : '⏱️';
      message += `${idx + 1}. [${item.time}] ${statusIcon} *${item.titleAr}*\n`;
      message += `   👤 المسؤول: ${item.responsibleRoleAr}${item.responsiblePerson ? ` (${item.responsiblePerson})` : ''}\n`;
      if (item.notes) message += `   💡 ملاحظة: ${item.notes}\n`;
      message += `\n`;
    });

    message += `تم التنسيق عبر منصة مناسبتـي 🇸🇦`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-emerald-900/20 via-teal-900/10 to-transparent border border-emerald-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-emerald-500" />
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              جدول سير فعاليات يوم المناسبة (Run-of-Show)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            تنسيق دقيق لساعة الصفر وفقرات الحفل من وصول أول فريق وحتى توديع آخر الضيوف.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            إضافة فقرة
          </button>
          <button
            onClick={shareScheduleViaWhatsApp}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs sm:text-sm font-semibold transition-colors border border-emerald-200 dark:border-emerald-800"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            مشاركة واتساب
          </button>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
        <span className="text-neutral-400 font-medium pl-2 shrink-0">تصفية حسب:</span>
        {[
          { id: 'all', label: 'الكل' },
          { id: 'coordinator', label: 'منسق الحفل' },
          { id: 'catering', label: 'الضيافة والإعاشة' },
          { id: 'photographer', label: 'التصوير' },
          { id: 'music', label: 'العرضة والموسيقى' },
          { id: 'family', label: 'أهل المناسبة' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedRoleFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all ${
              selectedRoleFilter === tab.id
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline List */}
      <div className="relative border-r-2 border-dashed border-neutral-200 dark:border-neutral-800 mr-4 pr-6 space-y-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800/30 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
            <Clock className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
              لا توجد فقرات مدرجة في هذا التصنيف
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              + اضغط هنا لإضافة أول فقرة
            </button>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="relative group bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all"
            >
              {/* Timeline Dot with Icon */}
              <div className="absolute -right-[37px] top-6 w-8 h-8 rounded-full bg-white dark:bg-neutral-900 border-2 border-emerald-500 flex items-center justify-center shadow-sm">
                {getIconComponent(item.iconName, item.responsibleRole)}
              </div>

              {/* Card Top Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-base font-bold text-neutral-900 dark:text-white px-2.5 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                    {item.time}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    ({item.durationMinutes} دقيقة)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                    {item.responsibleRoleAr}
                  </span>
                </div>

                {/* Status Toggle Selector */}
                <div className="flex items-center gap-2">
                  <select
                    value={item.status}
                    onChange={(e) =>
                      updateRunOfShowItem(item.id, {
                        status: e.target.value as RunOfShowItem['status'],
                      })
                    }
                    className="text-xs bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl py-1 px-2.5 text-neutral-700 dark:text-neutral-300 font-semibold focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="pending">قيد الانتظار</option>
                    <option value="in_progress">جارية الآن</option>
                    <option value="completed">اكتملت</option>
                    <option value="delayed">متأخرة</option>
                  </select>

                  <button
                    onClick={() => deleteRunOfShowItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-600 p-1 rounded-lg transition-all"
                    title="حذف الفقرة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Description */}
              <h4 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
                {item.titleAr}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-3">
                {item.descriptionAr}
              </p>

              {/* Footer Meta (Person, Phone, Notes) */}
              <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 text-xs">
                {item.responsiblePerson && (
                  <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>المسؤول: <strong>{item.responsiblePerson}</strong></span>
                  </div>
                )}
                {item.responsiblePhone && (
                  <a
                    href={`tel:${item.responsiblePhone}`}
                    className="flex items-center gap-1.5 text-emerald-600 hover:underline font-mono"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{item.responsiblePhone}</span>
                  </a>
                )}
                {item.notes && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mr-auto bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
                    <span>💡 {item.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <h3 className="font-bold text-neutral-900 dark:text-white text-base">
                إضافة فقرة جديدة لجدول يوم المناسبة
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    الوقت (ساعة:دقيقة)
                  </label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-mono text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    المدة التقديرية (بالدقائق)
                  </label>
                  <input
                    type="number"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    min={5}
                    max={360}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-mono text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  عنوان الفقرة أو الحدث *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: وصول الضيوف، بدء العرضة، تقطيع الكيك"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  الوصف والتفاصيل
                </label>
                <textarea
                  rows={2}
                  placeholder="التفاصيل والإجراءات المطلوبة..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    الفريق أو الدور المسؤول
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const val = e.target.value as RunOfShowItem['responsibleRole'];
                      setNewRole(val);
                      const labels: Record<string, string> = {
                        coordinator: 'منسق الحفل',
                        catering: 'الضيافة والإعاشة',
                        photographer: 'فريق التصوير',
                        music: 'العرضة والموسيقى',
                        family: 'أهل المناسبة',
                        hall_manager: 'إدارة القاعة',
                        other: 'أخرى',
                      };
                      setNewRoleAr(labels[val] || 'أخرى');
                    }}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                  >
                    <option value="coordinator">منسق الحفل</option>
                    <option value="catering">الضيافة والإعاشة</option>
                    <option value="photographer">فريق التصوير</option>
                    <option value="music">العرضة والموسيقى</option>
                    <option value="family">أهل المناسبة</option>
                    <option value="hall_manager">إدارة القاعة</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    اسم الشخص المسؤول
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: فهد، استوديو وميض"
                    value={newPerson}
                    onChange={(e) => setNewPerson(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    رقم الجوال للتواصل السريع
                  </label>
                  <input
                    type="tel"
                    placeholder="+9665xxxxxxxx"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-mono text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    ملاحظات هامة
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: تجهيز المباخر"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors"
                >
                  حفظ وإدراج في الجدول
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-3 px-5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-sm hover:bg-neutral-200"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
