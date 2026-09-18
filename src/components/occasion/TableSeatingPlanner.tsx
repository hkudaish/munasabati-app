'use client';

import React, { useState } from 'react';
import { Armchair, Plus, Users, UserCheck, X, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { SeatingTable } from '@/lib/types';

import { VisualFloorPlan } from './VisualFloorPlan';

export default function TableSeatingPlanner() {
  const { activeOccasion, tables, addTable, guests, assignGuestToTable } = useApp();

  const [viewMode, setViewMode] = useState<'canvas' | 'grid'>('canvas');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tableName, setTableName] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [section, setSection] = useState<'women' | 'men' | 'vip' | 'general'>('women');

  const [selectedTable, setSelectedTable] = useState<SeatingTable | null>(null);

  if (!activeOccasion) return null;

  const occasionTables = tables.filter((t) => t.occasionId === activeOccasion.id);
  const occasionGuests = guests.filter((g) => g.occasionId === activeOccasion.id);
  const unassignedGuests = occasionGuests.filter((g) => !g.tableId);

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) return;

    addTable({
      occasionId: activeOccasion.id,
      name: tableName,
      capacity: Number(capacity) || 10,
      section,
      assignedGuestIds: [],
    });

    setTableName('');
    setCapacity('10');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
        <div>
          <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
            <Armchair className="w-5 h-5 text-saudi-gold-600" />
            <span>مخطط توزيع الطاولات والمقاعد ({occasionTables.length} طاولات)</span>
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            خصص مقاعد الضيوف لتنظيم استقبال القاعة وتوجيه المدعوين بسهولة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-saudi-sand-100 rounded-xl border border-saudi-sand-300 text-xs font-bold">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'canvas'
                  ? 'bg-saudi-green-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              المخطط البصري (2D)
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-saudi-green-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              العرض المجدول
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-saudi-gold-400" />
            <span>+ إضافة طاولة</span>
          </button>
        </div>
      </div>

      {viewMode === 'canvas' ? (
        <VisualFloorPlan
          tables={occasionTables}
          guests={occasionGuests}
          onAssignGuest={(guestId, tableId) => assignGuestToTable(guestId, tableId)}
          onAddTable={(newT) => addTable(newT)}
        />
      ) : (
        /* Tables Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {occasionTables.map((table) => {
          const assignedGuestsList = occasionGuests.filter((g) => g.tableId === table.id);
          const isFull = assignedGuestsList.length >= table.capacity;

          return (
            <div
              key={table.id}
              className={`bg-white rounded-2xl p-5 border transition shadow-sm space-y-4 ${
                isFull ? 'border-saudi-green-300 bg-saudi-sand-50/40' : 'border-saudi-sand-300 hover:border-saudi-gold-400'
              }`}
            >
              {/* Table Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-saudi-gold-100 text-saudi-gold-800 flex items-center justify-center font-bold">
                    <Armchair className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-gray-900 font-cairo">{table.name}</h5>
                    <span className="text-[10px] text-gray-400">
                      {table.section === 'vip' ? 'طاولة كبار الشخصيات VIP' : table.section === 'women' ? 'قسم النساء' : 'قسم الرجال'}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    isFull
                      ? 'bg-red-100 text-red-700'
                      : 'bg-saudi-green-100 text-saudi-green-800'
                  }`}
                >
                  {assignedGuestsList.length} / {table.capacity} مقاعد
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${isFull ? 'bg-red-500' : 'bg-saudi-green-700'}`}
                  style={{ width: `${Math.min(100, (assignedGuestsList.length / table.capacity) * 100)}%` }}
                />
              </div>

              {/* Assigned guests chips */}
              <div className="space-y-1.5 min-h-[70px]">
                <span className="text-[10px] font-bold text-gray-400 block">الضيوف المخصصون:</span>
                {assignedGuestsList.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">لا يوجد ضيوف مخصصون بعد على هذه الطاولة.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedGuestsList.map((g) => (
                      <span
                        key={g.id}
                        className="bg-saudi-sand-100 border border-saudi-sand-300 text-gray-800 text-[11px] font-medium px-2 py-1 rounded-lg flex items-center gap-1"
                      >
                        <span>{g.name}</span>
                        <button
                          onClick={() => assignGuestToTable(g.id, '')}
                          className="text-gray-400 hover:text-red-600 mr-0.5"
                          title="إلغاء التخصيص"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Assign Guest button */}
              {!isFull && unassignedGuests.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        assignGuestToTable(e.target.value, table.id);
                        e.target.value = '';
                      }
                    }}
                    className="w-full text-xs p-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-saudi-green-900 font-medium focus:outline-none focus:border-saudi-gold-500"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      + تعيين ضيف على هذه الطاولة...
                    </option>
                    {unassignedGuests.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.category === 'women' ? 'نساء' : 'رجال'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Add Table Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-gray-900 font-cairo">
              إضافة طاولة جديدة
            </h4>

            <form onSubmit={handleAddTable} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم / رقم الطاولة</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="مثال: طاولة أهل العروس، طاولة رقم 4..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">سعة المقاعد</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">القسم</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  >
                    <option value="women">قسم النساء</option>
                    <option value="men">قسم الرجال</option>
                    <option value="vip">كبار الشخصيات VIP</option>
                    <option value="general">عام / عائلي</option>
                  </select>
                </div>
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
                  حفظ الطاولة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
