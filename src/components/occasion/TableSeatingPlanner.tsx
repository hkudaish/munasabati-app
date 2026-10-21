'use client';

import React, { useMemo, useState } from 'react';
import { Armchair, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { SECTION_LABEL, SHAPE_LABEL, SIZE_LABEL, seatedGuestIds, seatsOf } from '@/lib/floor-plan';
import FloorPlanEditor from './FloorPlanEditor';
import { seatGuestAtTable, unseatGuest, useFloorPlan } from './useFloorPlan';

export default function TableSeatingPlanner() {
  const { activeOccasion, guests, assignGuestToTable } = useApp();
  const plan = useFloorPlan(activeOccasion?.id);
  const [viewMode, setViewMode] = useState<'canvas' | 'grid'>('canvas');
  const occasionGuests = useMemo(() => guests.filter(g => g.occasionId === activeOccasion?.id), [guests, activeOccasion?.id]);

  if (!activeOccasion) return null;
  const { layout } = plan;
  const seated = seatedGuestIds(layout);
  const unseated = occasionGuests.filter(g => g.status !== 'declined' && !seated.has(g.id));
  const byId = new Map(occasionGuests.map(g => [g.id, g]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-saudi-sand-300 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h4 className="flex items-center gap-2 font-cairo text-base font-bold text-gray-900">
            <Armchair className="h-5 w-5 text-saudi-gold-600" aria-hidden="true" />
            <span>مخطط توزيع الطاولات والمقاعد ({layout.tables.length} طاولات)</span>
          </h4>
          <p className="mt-1 text-xs text-gray-600">رتّب القاعة بالسحب والإفلات، ثم وزّع الضيوف على المقاعد لتنظيم الاستقبال وتوجيه المدعوين بسهولة.</p>
        </div>
        <div className="flex items-center rounded-xl border border-saudi-sand-300 bg-saudi-sand-100 p-1 text-xs font-bold" role="tablist" aria-label="طريقة العرض">
          {(['canvas', 'grid'] as const).map(mode => (
            <button key={mode} role="tab" aria-selected={viewMode === mode} onClick={() => setViewMode(mode)}
              className={`rounded-lg px-3 py-1.5 transition ${viewMode === mode ? 'bg-saudi-green-800 text-white shadow-sm' : 'text-gray-700 hover:text-gray-900'}`}>
              {mode === 'canvas' ? 'المخطط البصري (2D)' : 'العرض المجدول'}
            </button>))}
        </div>
      </div>

      {viewMode === 'canvas' ? (
        <FloorPlanEditor plan={plan} guests={occasionGuests} assign={assignGuestToTable} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {layout.tables.length === 0 && <p className="col-span-full rounded-2xl border border-saudi-sand-300 bg-white p-6 text-center text-sm text-gray-600">لا توجد طاولات بعد. أضف طاولات من «المخطط البصري».</p>}
          {layout.tables.map(table => {
            const chairs = seatsOf(layout, table.id), onTable = chairs.map(c => (c.guestId ? byId.get(c.guestId) : undefined)).filter(Boolean) as typeof occasionGuests;
            const isFull = chairs.length > 0 && onTable.length >= chairs.length;
            return (
              <div key={table.id} className={`space-y-4 rounded-2xl border bg-white p-5 shadow-sm transition ${isFull ? 'border-saudi-green-300 bg-saudi-sand-50/40' : 'border-saudi-sand-300 hover:border-saudi-gold-400'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-saudi-gold-100 font-bold text-saudi-gold-800"><Armchair className="h-5 w-5" aria-hidden="true" /></div>
                    <div>
                      <h5 className="font-cairo text-sm font-bold text-gray-900">{table.name}</h5>
                      <span className="text-caption2 text-gray-600">{SHAPE_LABEL[table.shape]} · {SIZE_LABEL[table.size]} · {SECTION_LABEL[table.section]}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isFull ? 'bg-red-100 text-red-700' : 'bg-saudi-green-100 text-saudi-green-800'}`}>{onTable.length} / {chairs.length} مقاعد</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${isFull ? 'bg-red-500' : 'bg-saudi-green-700'}`} style={{ width: `${chairs.length ? Math.min(100, (onTable.length / chairs.length) * 100) : 0}%` }} /></div>
                <div className="min-h-[70px] space-y-1.5">
                  <span className="block text-caption2 font-bold text-gray-600">الضيوف المخصصون:</span>
                  {onTable.length === 0 ? <p className="text-xs italic text-gray-600">لا يوجد ضيوف مخصصون بعد على هذه الطاولة.</p> : (
                    <div className="flex flex-wrap gap-1.5">
                      {onTable.map(g => (
                        <span key={g.id} className="flex items-center gap-1 rounded-lg border border-saudi-sand-300 bg-saudi-sand-100 px-2 py-1 text-xs font-medium text-gray-800">
                          <span>{g.name}</span>
                          <button onClick={() => unseatGuest(plan, assignGuestToTable, g.id)} className="text-gray-600 hover:text-red-600" aria-label={`إلغاء تخصيص ${g.name}`}><X className="h-3 w-3" aria-hidden="true" /></button>
                        </span>))}
                    </div>)}
                </div>
                {!isFull && unseated.length > 0 && chairs.length > 0 && (
                  <div className="border-t border-gray-100 pt-2">
                    <select aria-label={`تعيين ضيف على ${table.name}`} defaultValue="" onChange={e => { if (e.target.value) { seatGuestAtTable(plan, assignGuestToTable, e.target.value, table.id); e.target.value = ''; } }}
                      className="w-full rounded-xl border border-gray-200 bg-saudi-sand-50 p-2 text-xs font-medium text-saudi-green-900 focus:border-saudi-gold-500 focus:outline-none">
                      <option value="" disabled>+ تعيين ضيف على هذه الطاولة...</option>
                      {unseated.map(g => <option key={g.id} value={g.id}>{g.name} ({g.category === 'women' ? 'نساء' : g.category === 'men' ? 'رجال' : 'عائلة'})</option>)}
                    </select>
                  </div>)}
              </div>);
          })}
        </div>
      )}
    </div>
  );
}
