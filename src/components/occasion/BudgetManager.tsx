'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  PieChart,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import { BudgetItem } from '@/lib/types';

export default function BudgetManager() {
  const { activeOccasion, budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, updateOccasion, serviceCategories } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  const [newCategory, setNewCategory] = useState('decor');
  const [newTitle, setNewTitle] = useState('');
  const [newAllocated, setNewAllocated] = useState('');
  const [newSpent, setNewSpent] = useState('');
  const [newStatus, setNewStatus] = useState<'estimated' | 'booked' | 'paid'>('estimated');

  if (!activeOccasion) return null;

  const occasionBudgetItems = budgetItems.filter((b) => b.occasionId === activeOccasion.id);
  const totalAllocated = occasionBudgetItems.reduce((acc, curr) => acc + curr.allocatedAmount, 0);
  const totalSpent = occasionBudgetItems.reduce((acc, curr) => acc + curr.spentAmount, 0);
  const remainingBudget = activeOccasion.budget - totalSpent;
  const isOverBudget = totalSpent > activeOccasion.budget;
  const isAllocatedOver = totalAllocated > activeOccasion.budget;

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAllocated) return;

    if (editingItem) {
      updateBudgetItem(editingItem.id, {
        categoryNameAr: newTitle,
        categoryId: newCategory,
        allocatedAmount: Number(newAllocated),
        spentAmount: Number(newSpent) || 0,
        status: newStatus,
      });
      setEditingItem(null);
    } else {
      addBudgetItem({
        occasionId: activeOccasion.id,
        categoryId: newCategory,
        categoryNameAr: newTitle,
        allocatedAmount: Number(newAllocated),
        spentAmount: Number(newSpent) || 0,
        status: newStatus,
      });
    }

    // Update occasion spent
    const newTotalSpent = totalSpent + (Number(newSpent) || 0) - (editingItem ? editingItem.spentAmount : 0);
    updateOccasion(activeOccasion.id, { spent: newTotalSpent });

    // Reset Form
    setNewTitle('');
    setNewAllocated('');
    setNewSpent('');
    setIsAddModalOpen(false);
  };

  const handleOpenEdit = (item: BudgetItem) => {
    setEditingItem(item);
    setNewCategory(item.categoryId);
    setNewTitle(item.categoryNameAr);
    setNewAllocated(item.allocatedAmount.toString());
    setNewSpent(item.spentAmount.toString());
    setNewStatus(item.status);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Budget */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">الميزانية الإجمالية المحددة</span>
            <div className="w-8 h-8 rounded-lg bg-saudi-green-100 text-saudi-green-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-cairo text-saudi-green-950">
              {formatSAR(activeOccasion.budget)}
            </span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">
            الميزانية المخططة للمناسبة
          </span>
        </div>

        {/* Total Spent */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">المصروف الفعلي حتى الآن</span>
            <div className="w-8 h-8 rounded-lg bg-saudi-gold-100 text-saudi-gold-700 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-cairo text-saudi-gold-600">
              {formatSAR(totalSpent)}
            </span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full ${isOverBudget ? 'bg-red-500' : 'bg-saudi-gold-500'}`}
              style={{ width: `${Math.min(100, (totalSpent / activeOccasion.budget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">المتبقي من الميزانية</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              remainingBudget >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black font-cairo ${
              remainingBudget >= 0 ? 'text-green-700' : 'text-red-600'
            }`}>
              {formatSAR(remainingBudget)}
            </span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">
            {remainingBudget >= 0 ? 'رصيد آمن متاح للصرف' : 'تجاوز في الميزانية المقررة'}
          </span>
        </div>
      </div>

      {/* AI Budget Intelligence Alert */}
      {isAllocatedOver ? (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h5 className="font-bold text-amber-900">
              تنبيه ذكي: مجموع التخصيصات يتجاوز الميزانية بمقدار {formatSAR(totalAllocated - activeOccasion.budget)}
            </h5>
            <p className="text-amber-800">
              توصي المستشارة "لُـمى" بدمج بعض بنود الضيافة أو اختيار باقة تخرج/ملكة متكاملة لتوفير ما يصل إلى 20% بدلاً من الحجوزات المنفصلة.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-saudi-green-50 border border-saudi-green-200 p-4 rounded-2xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-saudi-green-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h5 className="font-bold text-saudi-green-900">
              توزيع الميزانية متوازن وممتاز!
            </h5>
            <p className="text-saudi-green-800">
              معدل التكلفة لكل ضيف حالياً يبلغ حوالي {formatSAR(Math.round(activeOccasion.budget / (activeOccasion.guestCount || 1)))}، وهو ضمن النطاق الأمثل لمناسبات الـ {activeOccasion.tier === 'luxury' ? 'VIP الفاخرة' : 'المتوسطة'}.
            </p>
          </div>
        </div>
      )}

      {/* Action Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold text-gray-900 font-cairo">
          بنود الميزانية والتكاليف ({occasionBudgetItems.length})
        </h4>
        <button
          onClick={() => {
            setEditingItem(null);
            setNewTitle('');
            setNewAllocated('');
            setNewSpent('');
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Plus className="w-4 h-4 text-saudi-gold-400" />
          <span>+ إضافة بند ميزانية</span>
        </button>
      </div>

      {/* Budget Items Table / Cards */}
      <div className="bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-saudi-sand-100 text-gray-600 font-bold border-b border-saudi-sand-300">
              <tr>
                <th className="p-3.5">بند المصروف</th>
                <th className="p-3.5">المبلغ المقدر</th>
                <th className="p-3.5">المصروف الفعلي</th>
                <th className="p-3.5">المورد المرتبط</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {occasionBudgetItems.map((item) => (
                <tr key={item.id} className="hover:bg-saudi-sand-50/60 transition">
                  <td className="p-3.5">
                    <span className="font-bold text-gray-900 block">{item.categoryNameAr}</span>
                    <span className="text-[10px] text-gray-400">{item.categoryId}</span>
                  </td>
                  <td className="p-3.5 font-semibold text-gray-700">
                    {formatSAR(item.allocatedAmount)}
                  </td>
                  <td className="p-3.5 font-bold text-saudi-green-900">
                    {item.spentAmount > 0 ? formatSAR(item.spentAmount) : '—'}
                  </td>
                  <td className="p-3.5 text-gray-600">
                    {item.vendorName || <span className="text-gray-400 italic">لم يحدد بعد</span>}
                  </td>
                  <td className="p-3.5">
                    {item.status === 'paid' && (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        مدفوع بالكامل
                      </span>
                    )}
                    {item.status === 'booked' && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        تم الحجز (عربون)
                      </span>
                    )}
                    {item.status === 'estimated' && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        تقديري
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-gray-500 hover:text-saudi-green-800 rounded-lg hover:bg-gray-100"
                        title="تعديل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteBudgetItem(item.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-gray-900 font-cairo">
              {editingItem ? 'تعديل بند الميزانية' : 'إضافة بند ميزانية جديد'}
            </h4>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم البند</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: كوشة الورد الطبيعي، بوفيه الذبائح..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">التصنيف</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                >
                  {serviceCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ المقدر (ر.س)</label>
                  <input
                    type="number"
                    value={newAllocated}
                    onChange={(e) => setNewAllocated(e.target.value)}
                    placeholder="5000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المصروف الفعلي (ر.س)</label>
                  <input
                    type="number"
                    value={newSpent}
                    onChange={(e) => setNewSpent(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">حالة البند</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                >
                  <option value="estimated">تقديري (لم يتم الحجز بعد)</option>
                  <option value="booked">تم الحجز (دفع العربون)</option>
                  <option value="paid">مدفوع بالكامل</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl"
                >
                  {editingItem ? 'حفظ التعديلات' : 'إضافة البند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
