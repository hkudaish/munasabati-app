'use client';

import React, { useState } from 'react';
import { SeatingTable, Guest } from '@/lib/types';
import { 
  Users, 
  Sparkles, 
  Printer, 
  Maximize2, 
  Minimize2, 
  Plus, 
  X, 
  CheckCircle2, 
  DoorOpen, 
  Utensils, 
  Crown,
  ChevronRight,
  Info
} from 'lucide-react';

interface VisualFloorPlanProps {
  tables: SeatingTable[];
  guests: Guest[];
  onAssignGuest: (guestId: string, tableId: string) => void;
  onAddTable: (table: Omit<SeatingTable, 'id'>) => void;
}

export const VisualFloorPlan: React.FC<VisualFloorPlanProps> = ({
  tables,
  guests,
  onAssignGuest,
  onAddTable,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(tables[0]?.id || null);
  const [isAddTableOpen, setIsAddTableOpen] = useState<boolean>(false);
  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(8);
  const [newTableSection, setNewTableSection] = useState<SeatingTable['section']>('women');

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];
  const assignedGuests = guests.filter((g) => g.tableId === selectedTable?.id);
  const unseatedGuests = guests.filter((g) => !g.tableId && g.status !== 'declined');

  const handleCreateNewTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;

    onAddTable({
      name: newTableName,
      capacity: Number(newTableCapacity) || 8,
      section: newTableSection,
      assignedGuestIds: [],
      occasionId: selectedTable?.occasionId || 'occ-demo-1',
    });

    setIsAddTableOpen(false);
    setNewTableName('');
  };

  const handlePrintMap = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Floor Plan Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-neutral-900 text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold">المخطط البصري التفاعلي للقاعة (2D Floor Plan)</h3>
          </div>
          <p className="text-xs text-neutral-400">
            توزيع الطاولات والمنصة الملكية وبوابات الدخول والبوفيه لتنظيم حركة الضيوف بالقاعة.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsAddTableOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة طاولة
          </button>
          <button
            onClick={handlePrintMap}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition border border-neutral-700"
          >
            <Printer className="w-4 h-4" />
            طباعة المخطط
          </button>
        </div>
      </div>

      {/* Main Grid: Visual Canvas (Right 8 cols) & Selected Table Inspector (Left 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visual 2D Hall Canvas */}
        <div className="lg:col-span-8 bg-neutral-950 p-6 sm:p-8 rounded-3xl border-2 border-dashed border-neutral-800 shadow-inner min-h-[500px] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* 1. Stage / Kosha Header Section */}
          <div className="relative z-10 mx-auto w-3/4 max-w-md py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-neutral-950 font-black text-center text-xs sm:text-sm shadow-xl shadow-amber-500/20 border border-amber-300 flex items-center justify-center gap-2">
            <Crown className="w-4 h-4" />
            <span>منصة الكوشة الملكية والمسرح الرئيسي</span>
            <Crown className="w-4 h-4" />
          </div>

          {/* 2. Middle Hall Area: Tables Matrix */}
          <div className="relative z-10 py-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 justify-items-center">
            {tables.map((table, index) => {
              const assignedCount = guests.filter((g) => g.tableId === table.id).length;
              const isFull = assignedCount >= table.capacity;
              const isSelected = table.id === selectedTable?.id;

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTableId(table.id)}
                  className={`group relative flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 focus:outline-none ${
                    table.section === 'vip' ? 'w-28 h-28' : 'w-24 h-24'
                  } ${
                    isSelected
                      ? 'ring-4 ring-emerald-500 shadow-xl shadow-emerald-500/30 scale-105 bg-emerald-950/80 border-2 border-emerald-400'
                      : isFull
                      ? 'bg-neutral-800/80 border-2 border-neutral-700 hover:border-neutral-500'
                      : 'bg-neutral-900/90 border-2 border-neutral-700 hover:border-emerald-500/70 hover:scale-105'
                  }`}
                >
                  {/* Chairs surround simulation */}
                  <div className="absolute -inset-1.5 rounded-full border border-dashed border-neutral-700 group-hover:border-neutral-500 pointer-events-none" />

                  {table.section === 'vip' && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                  )}

                  <span className="font-bold text-xs text-white line-clamp-1">
                    {table.name}
                  </span>

                  <span className={`text-[10px] font-mono font-bold mt-0.5 ${
                    isFull ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {assignedCount} / {table.capacity}
                  </span>

                  <span className="text-[9px] text-neutral-400">
                    {table.section === 'vip' ? 'VIP' : table.section === 'men' ? 'رجال' : 'نساء'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. Bottom Hall Perimeter: Buffet Area & Entrance Gate */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-neutral-800">
            {/* Buffet Area */}
            <div className="flex items-center gap-2 py-2 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold">
              <Utensils className="w-4 h-4 text-orange-400" />
              <span>منطقة بوفيه العشاء المفتوح والمشروبات</span>
            </div>

            {/* Entrance Gate */}
            <div className="flex items-center gap-2 py-2 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold">
              <DoorOpen className="w-4 h-4 text-emerald-400" />
              <span>بوابة الاستقبال ومسح الباركود (Gate Entrance)</span>
            </div>
          </div>
        </div>

        {/* Selected Table Detail Inspector (Left Column) */}
        <div className="lg:col-span-4 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
          {selectedTable ? (
            <>
              {/* Table Info Header */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-neutral-900 dark:text-white">
                      {selectedTable.name}
                    </h4>
                    {selectedTable.section === 'vip' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                        طاولة VIP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    القسم: {selectedTable.section === 'men' ? 'قسم الرجال' : selectedTable.section === 'women' ? 'قسم النساء' : 'طاولة خاصة'}
                  </p>
                </div>

                <div className="text-left font-mono">
                  <span className="text-[10px] text-neutral-400 block">الإشغال</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {assignedGuests.length} / {selectedTable.capacity} مقعد
                  </span>
                </div>
              </div>

              {/* Seated Guests on this Table */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                  الضيوف المخصصون لهذه الطاولة ({assignedGuests.length}):
                </span>

                {assignedGuests.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-3 text-center bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl">
                    لم يتم تعيين أي ضيوف على هذه الطاولة حتى الآن.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {assignedGuests.map((guest) => (
                      <div
                        key={guest.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800 text-xs"
                      >
                        <div>
                          <span className="font-bold text-neutral-900 dark:text-white block">
                            {guest.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {guest.companionCount > 0 ? `+ ${guest.companionCount} مرافقين` : 'بدون مرافق'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onAssignGuest(guest.id, '')}
                          className="p-1 text-neutral-400 hover:text-rose-500 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-700"
                          title="إزالة من الطاولة"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign Unseated Guests */}
              <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                  إضافة ضيف غير معيّن ({unseatedGuests.length} متاح):
                </span>

                {unseatedGuests.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-2">
                    جميع المعازيم لديهم طاولات مخصصة!
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {unseatedGuests.slice(0, 5).map((guest) => (
                      <div
                        key={guest.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                      >
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {guest.name}
                        </span>
                        <button
                          type="button"
                          disabled={assignedGuests.length >= selectedTable.capacity}
                          onClick={() => onAssignGuest(guest.id, selectedTable.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-40"
                        >
                          + تعيين
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-neutral-400 text-xs">
              اختر طاولة من المخطط لعرض بياناتها وإدارتها
            </div>
          )}
        </div>
      </div>

      {/* Add Table Modal */}
      {isAddTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                إضافة طاولة جديدة إلى المخطط
              </h3>
              <button
                onClick={() => setIsAddTableOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  اسم أو رقم الطاولة
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: طاولة VIP 1، طاولة أهل العريس"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    سعة المقاعد
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-mono text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    القسم
                  </label>
                  <select
                    value={newTableSection}
                    onChange={(e) => setNewTableSection(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                  >
                    <option value="women">قسم النساء</option>
                    <option value="men">قسم الرجال</option>
                    <option value="vip">طاولة VIP</option>
                    <option value="general">عام</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                >
                  إضافة الطاولة
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="py-3 px-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-xs"
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
