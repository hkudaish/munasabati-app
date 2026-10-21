'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Armchair, Copy, Crown, DoorOpen, Plus, Printer, RotateCw, Sparkles, Trash2, Undo2, Users, Utensils, Wand2, X } from 'lucide-react';
import type { Guest } from '@/lib/types';
import {
  CANVAS, CHAIR, DIMENSIONS, MAX_CHAIRS, MAX_SEATS_PER_TABLE, MAX_TABLES, SECTIONS, SECTION_LABEL, SHAPES, SHAPE_LABEL, SIZES, SIZE_LABEL,
  arrangeChairs, defaultSeats, makeTable, newId, seatedGuestIds, seatsOf, tableAt, tableBox,
  type PlanChair, type PlanTable, type Section, type Shape, type Size,
} from '@/lib/floor-plan';
import { seatGuest, seatGuestAtTable, unseatGuest, type AssignGuest, type FloorPlan } from './useFloorPlan';

const TONE: Record<Section, { line: string; fill: string }> = {
  women: { line: '#f472b6', fill: 'rgba(244,114,182,0.14)' },
  men: { line: '#38bdf8', fill: 'rgba(56,189,248,0.14)' },
  vip: { line: '#fbbf24', fill: 'rgba(251,191,36,0.16)' },
  general: { line: '#34d399', fill: 'rgba(52,211,153,0.14)' },
};
const snap = (n: number, step = 5) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const input = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:opacity-40';

type Drag =
  | { kind: 'table'; id: string; sx: number; sy: number; ox: number; oy: number; chairs: Map<string, { x: number; y: number }>; moved: boolean }
  | { kind: 'chair'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { kind: 'new'; shape: Shape; size: Size; section: Section; sx: number; sy: number; moved: boolean }
  | { kind: 'guest'; guestId: string; label: string };
type Selection = { kind: 'table' | 'chair'; id: string } | null;

function ShapeGlyph({ shape, size, active }: { shape: Shape; size: Size; active?: boolean }) {
  const d = DIMENSIONS[shape][size], k = 30 / Math.max(d.w, d.h);
  return <span aria-hidden="true" style={{ width: Math.max(10, d.w * k), height: Math.max(10, d.h * k), borderRadius: shape === 'round' || shape === 'oval' ? 999 : 4 }} className={`inline-block border-2 ${active ? 'border-emerald-600 bg-emerald-100' : 'border-neutral-500 bg-neutral-100'}`} />;
}

export default function FloorPlanEditor({ plan, guests, assign }: { plan: FloorPlan; guests: Guest[]; assign: AssignGuest }) {
  const { layout } = plan;
  const [selected, setSelected] = useState<Selection>(null);
  const [palette, setPalette] = useState<{ shape: Shape; size: Size; section: Section }>({ shape: 'round', size: 'medium', section: 'general' });
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const planRef = useRef(plan); planRef.current = plan;
  const assignRef = useRef(assign); assignRef.current = assign;
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const guestsRef = useRef(guests); guestsRef.current = guests;
  const paletteRef = useRef(palette); paletteRef.current = palette;

  const say = useCallback((text: string) => { setNote(text); window.clearTimeout((say as any).t); (say as any).t = window.setTimeout(() => setNote(''), 4500); }, []);

  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const measure = () => setScale(el.getBoundingClientRect().width / CANVAS.w);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * CANVAS.w, y: ((clientY - r.top) / r.height) * CANVAS.h, inside: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom };
  };

  const guestById = useMemo(() => new Map(guests.map(g => [g.id, g])), [guests]);
  const seated = useMemo(() => seatedGuestIds(layout), [layout]);
  const eligible = guests.filter(g => g.status !== 'declined');
  const unseated = eligible.filter(g => !seated.has(g.id));
  const totalChairs = layout.chairs.length;

  // ---- adding -----------------------------------------------------------------------------------------------------
  const freeSpot = (shape: Shape, size: Size) => {
    const { w, h } = tableBox({ shape, size, rot: 0 });
    for (let y = 120; y < CANVAS.h - 80; y += 150) for (let x = 120; x < CANVAS.w - 80; x += 170) {
      if (layout.tables.every(t => { const b = tableBox(t); return Math.abs(t.x - x) > (b.w + w) / 2 + CHAIR * 2 || Math.abs(t.y - y) > (b.h + h) / 2 + CHAIR * 2; })) return { x, y };
    }
    return { x: CANVAS.w / 2, y: CANVAS.h / 2 };
  };
  const addTableAt = (p: { shape: Shape; size: Size; section: Section }, at: { x: number; y: number }) => {
    const cur = planRef.current.layout;
    const seats = defaultSeats(p);
    if (cur.tables.length >= MAX_TABLES) return say(`الحد الأقصى ${MAX_TABLES} طاولة`);
    if (cur.chairs.length + seats > MAX_CHAIRS) return say('تجاوزت الحد الأقصى للمقاعد');
    const { table, chairs } = makeTable(p.shape, p.size, { x: snap(at.x), y: snap(at.y) }, `طاولة ${cur.tables.length + 1}`, p.section);
    planRef.current.apply(l => ({ ...l, tables: [...l.tables, table], chairs: [...l.chairs, ...chairs] }));
    setSelected({ kind: 'table', id: table.id });
    say(`أُضيفت ${table.name} (${SHAPE_LABEL[p.shape]}، ${seats} مقاعد)`);
  };

  // ---- dragging (mouse and touch) ---------------------------------------------------------------------------------
  const onMove = (ev: PointerEvent) => {
    const d = drag.current; if (!d) return;
    if (d.kind === 'guest' || d.kind === 'new') {
      if (d.kind === 'new' && !d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 5) d.moved = true;
      setGhost({ x: ev.clientX, y: ev.clientY, label: d.kind === 'guest' ? d.label : `${SHAPE_LABEL[d.shape]} · ${SIZE_LABEL[d.size]}` });
      return;
    }
    const raw = Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy);
    if (!d.moved) { if (raw < 4) return; d.moved = true; planRef.current.beginGesture(); }
    const dx = (ev.clientX - d.sx) / scaleRef.current, dy = (ev.clientY - d.sy) / scaleRef.current;
    if (d.kind === 'table') {
      const t = planRef.current.layout.tables.find(x => x.id === d.id); if (!t) return;
      const b = tableBox(t), pad = CHAIR * 1.5;
      const nx = clamp(snap(d.ox + dx), b.w / 2 + pad, CANVAS.w - b.w / 2 - pad), ny = clamp(snap(d.oy + dy), b.h / 2 + pad, CANVAS.h - b.h / 2 - pad);
      const ddx = nx - d.ox, ddy = ny - d.oy;
      planRef.current.apply(l => ({ ...l, tables: l.tables.map(x => (x.id === d.id ? { ...x, x: nx, y: ny } : x)), chairs: l.chairs.map(c => { const o = d.chairs.get(c.id); return o ? { ...c, x: clamp(o.x + ddx, CHAIR / 2, CANVAS.w - CHAIR / 2), y: clamp(o.y + ddy, CHAIR / 2, CANVAS.h - CHAIR / 2) } : c; }) }), { history: false });
    } else {
      const nx = clamp(d.ox + dx, CHAIR / 2, CANVAS.w - CHAIR / 2), ny = clamp(d.oy + dy, CHAIR / 2, CANVAS.h - CHAIR / 2);
      planRef.current.apply(l => ({ ...l, chairs: l.chairs.map(c => (c.id === d.id ? { ...c, x: nx, y: ny } : c)) }), { history: false });
    }
  };
  const onUp = (ev: PointerEvent, cancelled: boolean) => {
    const d = drag.current; drag.current = null; setGhost(null);
    if (!d) return;
    const current = planRef.current.layout;
    if (d.kind === 'table') { if (!d.moved) setSelected({ kind: 'table', id: d.id }); else say('نُقلت الطاولة'); return; }
    if (d.kind === 'chair') {
      if (!d.moved) { setSelected({ kind: 'chair', id: d.id }); return; }
      const chair = current.chairs.find(c => c.id === d.id); if (!chair) return;
      const target = tableAt({ x: chair.x, y: chair.y }, current.tables);
      const newTableId = target ? target.id : null;
      if (newTableId === chair.tableId) return;
      if (target && seatsOf(current, target.id).length >= MAX_SEATS_PER_TABLE) {
        planRef.current.apply(l => ({ ...l, chairs: l.chairs.map(c => (c.id === d.id ? { ...c, x: d.ox, y: d.oy } : c)) }), { history: false });
        return say(`لا يمكن إضافة أكثر من ${MAX_SEATS_PER_TABLE} مقعد للطاولة`);
      }
      planRef.current.apply(l => ({ ...l, chairs: l.chairs.map(c => (c.id === d.id ? { ...c, tableId: newTableId } : c)) }), { history: false });
      if (chair.guestId) assignRef.current(chair.guestId, target?.id ?? '', target?.name ?? '');
      say(target ? `انتقل المقعد إلى ${target.name}` : 'أصبح المقعد منفرداً');
      return;
    }
    if (d.kind === 'new') {
      if (cancelled) return;
      const p = { shape: d.shape, size: d.size, section: d.section };
      if (!d.moved) return addTableAt(p, freeSpot(d.shape, d.size));
      const pos = toCanvas(ev.clientX, ev.clientY);
      if (pos.inside) addTableAt(p, pos);
      return;
    }
    if (d.kind === 'guest') {
      if (cancelled) return;
      const stack = document.elementsFromPoint(ev.clientX, ev.clientY);
      const chairEl = stack.map(e => (e as HTMLElement).closest?.('[data-chair-id]')).find(Boolean) as HTMLElement | undefined;
      const tableEl = stack.map(e => (e as HTMLElement).closest?.('[data-table-id]')).find(Boolean) as HTMLElement | undefined;
      if (chairEl) { seatGuest(planRef.current, assignRef.current, d.guestId, chairEl.dataset.chairId!); say(`تم تعيين ${d.label}`); }
      else if (tableEl) { const r = seatGuestAtTable(planRef.current, assignRef.current, d.guestId, tableEl.dataset.tableId!); say(r === 'full' ? 'الطاولة ممتلئة' : `تم تعيين ${d.label}`); }
    }
  };
  const track = (event: React.PointerEvent, session: Drag) => {
    event.preventDefault(); event.stopPropagation();
    drag.current = session;
    const move = (e: PointerEvent) => onMove(e);
    const up = (e: PointerEvent) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); onUp(e, e.type === 'pointercancel'); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const startTable = (e: React.PointerEvent, t: PlanTable) => track(e, { kind: 'table', id: t.id, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, chairs: new Map(seatsOf(layout, t.id).map(c => [c.id, { x: c.x, y: c.y }])), moved: false });
  const startChair = (e: React.PointerEvent, c: PlanChair) => track(e, { kind: 'chair', id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y, moved: false });

  // ---- editing the selection ---------------------------------------------------------------------------------------
  const table = selected?.kind === 'table' ? layout.tables.find(t => t.id === selected.id) : undefined;
  const chair = selected?.kind === 'chair' ? layout.chairs.find(c => c.id === selected.id) : undefined;
  const editTable = (id: string, patch: Partial<PlanTable>, rearrange = false) => plan.apply(l => {
    const next = { ...l, tables: l.tables.map(t => (t.id === id ? { ...t, ...patch } : t)) };
    return rearrange ? arrangeChairs(next, id, Math.min(MAX_SEATS_PER_TABLE, Math.max(1, seatsOf(l, id).length))) : next;
  });
  const deleteTable = (id: string) => {
    const guestsOnIt = seatsOf(layout, id).map(c => c.guestId).filter(Boolean) as string[];
    guestsOnIt.forEach(g => assign(g, '', ''));
    plan.apply(l => ({ ...l, tables: l.tables.filter(t => t.id !== id), chairs: l.chairs.filter(c => c.tableId !== id) }));
    setSelected(null); say(guestsOnIt.length ? `حُذفت الطاولة وأُعيد ${guestsOnIt.length} ضيف إلى قائمة غير الموزعين` : 'حُذفت الطاولة');
  };
  const duplicateTable = (t: PlanTable) => {
    if (layout.tables.length >= MAX_TABLES) return say(`الحد الأقصى ${MAX_TABLES} طاولة`);
    const seats = seatsOf(layout, t.id).length;
    const copy = makeTable(t.shape, t.size, { x: t.x + 40, y: t.y + 40 }, `${t.name} (نسخة)`.slice(0, 60), t.section, seats);
    copy.table.rot = t.rot;
    plan.apply(l => arrangeChairs({ ...l, tables: [...l.tables, copy.table], chairs: [...l.chairs, ...copy.chairs] }, copy.table.id, seats));
    setSelected({ kind: 'table', id: copy.table.id });
  };
  const deleteChair = (c: PlanChair) => { if (c.guestId) assign(c.guestId, '', ''); plan.apply(l => ({ ...l, chairs: l.chairs.filter(x => x.id !== c.id) })); setSelected(null); };
  const addLooseChair = () => {
    if (layout.chairs.length >= MAX_CHAIRS) return say('تجاوزت الحد الأقصى للمقاعد');
    const c: PlanChair = { id: newId('c'), tableId: null, x: 60 + (layout.chairs.filter(x => !x.tableId).length % 12) * 28, y: CANVAS.h - 120, guestId: null };
    plan.apply(l => ({ ...l, chairs: [...l.chairs, c] })); setSelected({ kind: 'chair', id: c.id }); say('أُضيف مقعد منفرد؛ اسحبه إلى أي طاولة');
  };
  const autoSeat = () => {
    const free = new Map<Section, PlanChair[]>();
    for (const t of layout.tables) free.set(t.section, [...(free.get(t.section) || []), ...seatsOf(layout, t.id).filter(c => !c.guestId)]);
    const pick = (g: Guest): PlanChair | undefined => {
      const pref: Section[] = g.category === 'women' ? ['women', 'general'] : g.category === 'men' ? ['men', 'general'] : ['general', 'women', 'men'];
      for (const s of pref) { const list = free.get(s); if (list && list.length) return list.shift(); }
      return undefined;
    };
    let placed = 0;
    for (const g of unseated.slice(0, 200)) { const c = pick(g); if (!c) continue; seatGuest(planRef.current, assignRef.current, g.id, c.id); placed++; }
    say(placed ? `تم توزيع ${placed} ضيف تلقائياً حسب القسم` : 'لا توجد مقاعد مناسبة شاغرة');
  };

  // keyboard: arrows nudge, Delete removes, Ctrl+Z undoes
  const onNodeKey = (e: React.KeyboardEvent, kind: 'table' | 'chair', id: string) => {
    const step = e.shiftKey ? 25 : 5;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected({ kind, id }); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (kind === 'table') deleteTable(id); else { const c = layout.chairs.find(x => x.id === id); if (c) deleteChair(c); } return; }
    const m = delta[e.key]; if (!m) return;
    e.preventDefault(); setSelected({ kind, id });
    if (kind === 'table') plan.apply(l => { const t = l.tables.find(x => x.id === id)!; const b = tableBox(t); const nx = clamp(t.x + m[0], b.w / 2 + CHAIR, CANVAS.w - b.w / 2 - CHAIR), ny = clamp(t.y + m[1], b.h / 2 + CHAIR, CANVAS.h - b.h / 2 - CHAIR); const ddx = nx - t.x, ddy = ny - t.y; return { ...l, tables: l.tables.map(x => (x.id === id ? { ...x, x: nx, y: ny } : x)), chairs: l.chairs.map(c => (c.tableId === id ? { ...c, x: clamp(c.x + ddx, CHAIR / 2, CANVAS.w - CHAIR / 2), y: clamp(c.y + ddy, CHAIR / 2, CANVAS.h - CHAIR / 2) } : c)) }; });
    else plan.apply(l => ({ ...l, chairs: l.chairs.map(c => (c.id === id ? { ...c, x: clamp(c.x + m[0], CHAIR / 2, CANVAS.w - CHAIR / 2), y: clamp(c.y + m[1], CHAIR / 2, CANVAS.h - CHAIR / 2) } : c)) }));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) { e.preventDefault(); planRef.current.undo(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const statusText = { loading: 'جاري التحميل…', saving: 'جاري الحفظ…', saved: 'تم الحفظ', error: plan.message || 'تعذر الحفظ', conflict: plan.message }[plan.status];
  const statusTone = plan.status === 'saved' ? 'text-emerald-400' : plan.status === 'error' ? 'text-rose-400' : plan.status === 'conflict' ? 'text-amber-300' : 'text-neutral-400';
  const filteredGuests = eligible.filter(g => !search.trim() || g.name.includes(search.trim()));
  const tableOf = (guestId: string) => { const c = layout.chairs.find(x => x.guestId === guestId); return c?.tableId ? layout.tables.find(t => t.id === c.tableId)?.name : c ? 'مقعد منفرد' : undefined; };

  return (
    <div className="space-y-5">
      <p role="status" aria-live="polite" className="sr-only">{note}</p>
      {/* header */}
      <div className="no-print flex flex-col items-start justify-between gap-4 rounded-3xl bg-neutral-900 p-5 text-white shadow-lg sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-400" aria-hidden="true" /><h3 className="text-lg font-bold">المخطط البصري التفاعلي للقاعة (2D Floor Plan)</h3></div>
          <p className="text-xs text-neutral-400">اسحب الطاولات والكراسي لترتيب القاعة، واسحب الضيوف إلى المقاعد. يُحفظ كل تغيير تلقائياً.</p>
          <p className="mt-1 text-xs text-neutral-300">{layout.tables.length} طاولة · {totalChairs} مقعد · {seated.size} من {eligible.length} ضيف موزّع · <span className={statusTone} role={plan.status === 'error' ? 'alert' : undefined}>{statusText}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => plan.undo()} disabled={!plan.canUndo}><Undo2 className="h-4 w-4" aria-hidden="true" />تراجع</button>
          <button type="button" className={btn} onClick={autoSeat} disabled={!unseated.length || !totalChairs}><Wand2 className="h-4 w-4" aria-hidden="true" />توزيع تلقائي</button>
          <button type="button" className={btn} onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" />طباعة المخطط</button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* canvas */}
        <div className="lg:col-span-8">
          <div ref={canvasRef} dir="ltr" role="group" aria-label="مخطط القاعة" onPointerDown={() => setSelected(null)}
            className="relative w-full select-none overflow-hidden rounded-3xl border-2 border-dashed border-neutral-800 bg-neutral-950 shadow-inner"
            style={{ aspectRatio: `${CANVAS.w} / ${CANVAS.h}`, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: `${24 * scale}px ${24 * scale}px` }}>
            {/* fixed hall features */}
            <div className="pointer-events-none absolute left-1/2 top-[1.5%] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-5 py-1.5 text-xs font-bold text-neutral-950 shadow-lg shadow-amber-500/20" dir="rtl"><Crown className="h-4 w-4" aria-hidden="true" />منصة الكوشة الملكية والمسرح الرئيسي<Crown className="h-4 w-4" aria-hidden="true" /></div>
            <div className="pointer-events-none absolute bottom-[2%] right-[2%] flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300" dir="rtl"><Utensils className="h-4 w-4 text-orange-400" aria-hidden="true" />بوفيه العشاء والمشروبات</div>
            <div className="pointer-events-none absolute bottom-[2%] left-[2%] flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300" dir="rtl"><DoorOpen className="h-4 w-4 text-emerald-400" aria-hidden="true" />بوابة الاستقبال</div>
            {layout.tables.length === 0 && plan.status !== 'loading' && <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-neutral-400" dir="rtl">القاعة فارغة. اختر نوع الطاولة وحجمها من اللوحة ثم اسحبها إلى هنا (أو اضغط عليها لإضافتها).</p>}

            {layout.tables.map(t => {
              const { w, h } = tableBox(t), own = seatsOf(layout, t.id), filled = own.filter(c => c.guestId && guestById.has(c.guestId)).length;
              const tone = TONE[t.section], isSel = selected?.kind === 'table' && selected.id === t.id;
              return (
                <div key={t.id} data-table-id={t.id} role="button" tabIndex={0} aria-pressed={isSel}
                  aria-label={`${t.name}، ${SHAPE_LABEL[t.shape]}، ${filled} من ${own.length} مقاعد. الأسهم للتحريك، Delete للحذف`}
                  onPointerDown={e => startTable(e, t)} onKeyDown={e => onNodeKey(e, 'table', t.id)} onFocus={() => setSelected({ kind: 'table', id: t.id })}
                  className="absolute flex cursor-grab flex-col items-center justify-center text-center active:cursor-grabbing focus:outline-none"
                  style={{ left: (t.x - w / 2) * scale, top: (t.y - h / 2) * scale, width: w * scale, height: h * scale, zIndex: isSel ? 15 : 10, touchAction: 'none', border: `2px solid ${tone.line}`, background: tone.fill, borderRadius: t.shape === 'round' || t.shape === 'oval' ? 9999 : 12 * scale, boxShadow: isSel ? `0 0 0 3px #10b981, 0 0 24px ${tone.line}66` : undefined }}>
                  <span className="max-w-full truncate px-1 font-bold text-white" dir="rtl" style={{ fontSize: Math.max(8, 11 * scale) }}>{t.name}</span>
                  <span className="font-mono font-bold" style={{ fontSize: Math.max(8, 10 * scale), color: filled >= own.length && own.length ? '#fb7185' : tone.line }}>{filled}/{own.length}</span>
                </div>
              );
            })}

            {layout.chairs.map(c => {
              const t = c.tableId ? layout.tables.find(x => x.id === c.tableId) : undefined;
              const g = c.guestId ? guestById.get(c.guestId) : undefined, tone = TONE[t?.section ?? 'general'];
              const isSel = selected?.kind === 'chair' && selected.id === c.id, s = CHAIR * scale;
              return (
                <div key={c.id} data-chair-id={c.id} role="button" tabIndex={0} aria-pressed={isSel} title={g ? g.name : 'مقعد شاغر'}
                  aria-label={`مقعد ${g ? 'لـ ' + g.name : 'شاغر'}${t ? ' في ' + t.name : ' منفرد'}`}
                  onPointerDown={e => startChair(e, c)} onKeyDown={e => onNodeKey(e, 'chair', c.id)} onFocus={() => setSelected({ kind: 'chair', id: c.id })}
                  className="absolute flex cursor-grab items-center justify-center font-bold text-neutral-950 active:cursor-grabbing focus:outline-none"
                  style={{ left: c.x * scale - s / 2, top: c.y * scale - s / 2, width: s, height: s, zIndex: isSel ? 25 : 20, touchAction: 'none', borderRadius: 6 * scale, fontSize: Math.max(7, 9 * scale), border: `1.5px solid ${g ? tone.line : '#737373'}`, background: g ? tone.line : '#262626', boxShadow: isSel ? '0 0 0 2px #10b981' : undefined }}>
                  {g && s >= 13 ? Array.from(g.name.trim())[0] : null}
                </div>
              );
            })}
          </div>
          <p className="no-print mt-2 text-xs text-neutral-500">نصيحة: اسحب كرسياً إلى طاولة أخرى ليصبح من مقاعدها، أو بعيداً عن الطاولات ليصبح منفرداً. الأسهم تحرّك العنصر المحدد، و Ctrl+Z يتراجع.</p>
        </div>

        {/* side panel */}
        <div className="no-print space-y-4 lg:col-span-4">
          {/* palette */}
          <section aria-label="إضافة طاولة" className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><Plus className="h-4 w-4" aria-hidden="true" />إضافة طاولة</h4>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="نوع الطاولة">
              {SHAPES.map(s => (
                <button key={s} type="button" role="radio" aria-checked={palette.shape === s} onClick={() => setPalette(p => ({ ...p, shape: s }))}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-caption2 font-bold ${palette.shape === s ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}>
                  <ShapeGlyph shape={s} size="medium" active={palette.shape === s} />{SHAPE_LABEL[s].split(' ')[0]}
                </button>))}
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="حجم الطاولة">
              {SIZES.map(s => (
                <button key={s} type="button" role="radio" aria-checked={palette.size === s} onClick={() => setPalette(p => ({ ...p, size: s }))}
                  className={`rounded-xl border px-2 py-1.5 text-xs font-bold ${palette.size === s ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}>
                  {SIZE_LABEL[s]}<span className="block text-caption2 font-normal text-neutral-500">{DIMENSIONS[palette.shape][s].seats} مقاعد</span>
                </button>))}
            </div>
            <label className="block text-xs font-bold text-neutral-700">القسم
              <select className={input + ' mt-1'} value={palette.section} onChange={e => setPalette(p => ({ ...p, section: e.target.value as Section }))}>{SECTIONS.map(s => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}</select></label>
            <button type="button" onPointerDown={e => track(e, { kind: 'new', ...paletteRef.current, sx: e.clientX, sy: e.clientY, moved: false })}
              draggable={false} onDragStart={e => e.preventDefault()} className="flex w-full cursor-grab select-none items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-900 active:cursor-grabbing" style={{ touchAction: 'none', userSelect: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTableAt(palette, freeSpot(palette.shape, palette.size)); } }}>
              <ShapeGlyph shape={palette.shape} size={palette.size} active />اسحب إلى القاعة أو اضغط للإضافة
            </button>
            <button type="button" className={btn + ' w-full'} onClick={addLooseChair}><Armchair className="h-4 w-4" aria-hidden="true" />إضافة كرسي منفرد</button>
          </section>

          {/* inspector */}
          <section aria-label="العنصر المحدد" className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            {table ? (
              <>
                <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-neutral-900">الطاولة المحددة</h4><button type="button" aria-label="إلغاء التحديد" className="rounded-lg p-1 hover:bg-neutral-100" onClick={() => setSelected(null)}><X className="h-4 w-4" aria-hidden="true" /></button></div>
                <label className="block text-xs font-bold text-neutral-700">الاسم<input key={table.id + table.name} className={input + ' mt-1'} defaultValue={table.name} maxLength={60}
                  onBlur={e => { const v = e.target.value.trim().slice(0, 60); if (v && v !== table.name) { editTable(table.id, { name: v }); seatsOf(layout, table.id).forEach(c => c.guestId && assign(c.guestId, table.id, v)); } else e.target.value = table.name; }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-bold text-neutral-700">النوع<select className={input + ' mt-1'} value={table.shape} onChange={e => editTable(table.id, { shape: e.target.value as Shape }, true)}>{SHAPES.map(s => <option key={s} value={s}>{SHAPE_LABEL[s]}</option>)}</select></label>
                  <label className="block text-xs font-bold text-neutral-700">الحجم<select className={input + ' mt-1'} value={table.size} onChange={e => editTable(table.id, { size: e.target.value as Size }, true)}>{SIZES.map(s => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}</select></label>
                </div>
                <label className="block text-xs font-bold text-neutral-700">القسم<select className={input + ' mt-1'} value={table.section} onChange={e => editTable(table.id, { section: e.target.value as Section })}>{SECTIONS.map(s => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}</select></label>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-neutral-700">عدد المقاعد</span>
                  <span className="flex items-center gap-2">
                    <button type="button" className={btn} aria-label="تقليل المقاعد" disabled={seatsOf(layout, table.id).length <= 1} onClick={() => { const own = seatsOf(layout, table.id), taken = own.filter(c => c.guestId); const dropping = own.length === taken.length ? taken[taken.length - 1] : null; if (dropping?.guestId) assign(dropping.guestId, '', ''); plan.apply(l => arrangeChairs(l, table.id, own.length - 1)); }}>−</button>
                    <span className="min-w-6 text-center font-mono text-sm font-bold" aria-live="polite">{seatsOf(layout, table.id).length}</span>
                    <button type="button" className={btn} aria-label="زيادة المقاعد" disabled={seatsOf(layout, table.id).length >= MAX_SEATS_PER_TABLE || totalChairs >= MAX_CHAIRS} onClick={() => plan.apply(l => arrangeChairs(l, table.id, seatsOf(l, table.id).length + 1))}>+</button>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btn} onClick={() => editTable(table.id, { rot: ((table.rot + 90) % 360) as PlanTable['rot'] }, true)}><RotateCw className="h-4 w-4" aria-hidden="true" />تدوير</button>
                  <button type="button" className={btn} onClick={() => plan.apply(l => arrangeChairs(l, table.id))}><Armchair className="h-4 w-4" aria-hidden="true" />ترتيب المقاعد</button>
                  <button type="button" className={btn} onClick={() => duplicateTable(table)}><Copy className="h-4 w-4" aria-hidden="true" />نسخ</button>
                  <button type="button" className={btn + ' text-rose-700'} onClick={() => deleteTable(table.id)}><Trash2 className="h-4 w-4" aria-hidden="true" />حذف</button>
                </div>
                <div className="space-y-1.5 border-t border-neutral-100 pt-3">
                  <p className="text-xs font-bold text-neutral-700">الضيوف على هذه الطاولة</p>
                  {seatsOf(layout, table.id).filter(c => c.guestId && guestById.has(c.guestId)).map(c => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-2.5 py-1.5 text-xs"><span className="font-medium">{guestById.get(c.guestId!)!.name}</span>
                      <button type="button" aria-label={`إزالة ${guestById.get(c.guestId!)!.name} من الطاولة`} className="rounded p-1 text-neutral-500 hover:text-rose-600" onClick={() => unseatGuest(plan, assign, c.guestId!)}><X className="h-3.5 w-3.5" aria-hidden="true" /></button></div>))}
                  {seatsOf(layout, table.id).every(c => !c.guestId) && <p className="text-xs text-neutral-500">لا يوجد ضيوف بعد.</p>}
                  <label className="block text-xs font-bold text-neutral-700">إضافة ضيف
                    <select className={input + ' mt-1'} value="" onChange={e => { if (e.target.value) { const r = seatGuestAtTable(plan, assign, e.target.value, table.id); if (r === 'full') say('الطاولة ممتلئة'); } }}>
                      <option value="">اختر ضيفاً غير موزّع…</option>{unseated.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
                </div>
              </>
            ) : chair ? (
              <>
                <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-neutral-900">المقعد المحدد</h4><button type="button" aria-label="إلغاء التحديد" className="rounded-lg p-1 hover:bg-neutral-100" onClick={() => setSelected(null)}><X className="h-4 w-4" aria-hidden="true" /></button></div>
                <p className="text-xs text-neutral-600">{chair.tableId ? 'من ' + (layout.tables.find(t => t.id === chair.tableId)?.name ?? '') : 'مقعد منفرد'}</p>
                {chair.guestId && guestById.get(chair.guestId)
                  ? <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs"><span className="font-bold">{guestById.get(chair.guestId)!.name}</span><button type="button" className={btn} onClick={() => unseatGuest(plan, assign, chair.guestId!)}>إزالة الضيف</button></div>
                  : <label className="block text-xs font-bold text-neutral-700">تعيين ضيف على هذا المقعد
                      <select className={input + ' mt-1'} value="" onChange={e => { if (e.target.value) seatGuest(plan, assign, e.target.value, chair.id); }}><option value="">اختر ضيفاً غير موزّع…</option>{unseated.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
                <button type="button" className={btn + ' text-rose-700'} onClick={() => deleteChair(chair)}><Trash2 className="h-4 w-4" aria-hidden="true" />حذف المقعد</button>
              </>
            ) : <p className="py-4 text-center text-xs text-neutral-500">اختر طاولة أو مقعداً من المخطط لتعديله.</p>}
          </section>

          {/* guests */}
          <section aria-label="الضيوف" className="space-y-2 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><Users className="h-4 w-4" aria-hidden="true" />الضيوف ({unseated.length} غير موزّع)</h4>
            <input className={input} placeholder="ابحث عن ضيف" aria-label="بحث عن ضيف" value={search} onChange={e => setSearch(e.target.value)} />
            <p className="text-caption2 text-neutral-500">اسحب اسم الضيف وأفلته على مقعد أو على طاولة.</p>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {filteredGuests.length === 0 && <li className="py-2 text-center text-xs text-neutral-500">لا يوجد ضيوف.</li>}
              {filteredGuests.map(g => (
                <li key={g.id} draggable={false} onDragStart={e => e.preventDefault()} onPointerDown={e => track(e, { kind: 'guest', guestId: g.id, label: g.name })} style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                  className="flex cursor-grab select-none items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-2.5 py-1.5 text-xs hover:bg-emerald-50 active:cursor-grabbing">
                  <span className="truncate font-medium">{g.name}{g.companionCount > 0 && <span className="text-neutral-500"> +{g.companionCount}</span>}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption2 font-bold ${seated.has(g.id) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{seated.has(g.id) ? tableOf(g.id) : 'غير موزّع'}</span>
                </li>))}
            </ul>
          </section>
        </div>
      </div>

      {note && <p aria-hidden="true" className="no-print fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white shadow-lg">{note}</p>}
      {ghost && <div aria-hidden="true" className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-emerald-500 bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-xl" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}</div>}
    </div>
  );
}
