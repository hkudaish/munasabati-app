'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { emptyLayout, sanitizeLayout, seatsOf, type Layout, type PlanChair } from '@/lib/floor-plan';

export type SaveStatus = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';
const SAVE_DELAY_MS = 900;
const HISTORY = 40;

/**
 * The saved hall layout of one occasion: loads it, applies edits locally at once, saves them in the background
 * (debounced, with a version check so another open tab can never be overwritten silently) and keeps an undo history.
 */
export function useFloorPlan(occasionId: string | undefined) {
  const [layout, setLayout] = useState<Layout>(emptyLayout());
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [message, setMessage] = useState('');
  const [canUndo, setCanUndo] = useState(false);
  const layoutRef = useRef(layout);
  const versionRef = useRef(0);
  const past = useRef<Layout[]>([]);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(occasionId);
  idRef.current = occasionId;

  const adopt = useCallback((next: Layout) => { layoutRef.current = next; setLayout(next); }, []);

  const load = useCallback(async () => {
    if (!occasionId) return;
    setStatus('loading');
    try {
      const data = await requestJSON(`/api/occasions/${occasionId}/floor-plan`);
      let loaded = emptyLayout();
      try { loaded = sanitizeLayout(data.layout); } catch { /* damaged document: start empty */ }
      versionRef.current = data.version; past.current = []; setCanUndo(false); dirty.current = false;
      adopt(loaded); setStatus('saved'); setMessage('');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'تعذر تحميل المخطط'); }
  }, [occasionId, adopt]);
  useEffect(() => { void load(); }, [load]);

  const flush = useCallback(async () => {
    if (saving.current || !dirty.current || !idRef.current) return;
    saving.current = true; dirty.current = false; setStatus('saving');
    let failed = false;
    try {
      const result = await requestJSON(`/api/occasions/${idRef.current}/floor-plan`, 'PUT', { layout: layoutRef.current, version: versionRef.current });
      if (result.conflict) {
        // another tab saved first: take its version (nothing is lost on the server) and tell the user
        let theirs = emptyLayout(); try { theirs = sanitizeLayout(result.layout); } catch { /* keep empty */ }
        versionRef.current = result.version; past.current = []; setCanUndo(false); dirty.current = false; adopt(theirs);
        setStatus('conflict'); setMessage('عُدّل المخطط في نافذة أخرى، فتم تحميل أحدث نسخة.');
      } else { versionRef.current = result.version; setStatus(dirty.current ? 'saving' : 'saved'); setMessage(''); }
    } catch (error) { failed = true; dirty.current = true; setStatus('error'); setMessage(error instanceof Error ? error.message : 'تعذر الحفظ'); }
    finally { saving.current = false; if (dirty.current && !failed) timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS); } // after a failure the next edit retries; no retry storm
  }, [adopt]);

  const schedule = useCallback(() => {
    dirty.current = true; setStatus(s => (s === 'loading' ? s : 'saving'));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [flush]);

  /** Applies an edit. Pass `history: false` for the steps of a continuous gesture (a drag) after calling `beginGesture`. */
  const apply = useCallback((edit: (current: Layout) => Layout, options: { history?: boolean } = {}) => {
    const before = layoutRef.current, after = edit(before);
    if (after === before) return;
    if (options.history !== false) { past.current.push(before); if (past.current.length > HISTORY) past.current.shift(); setCanUndo(true); }
    adopt(after); schedule();
  }, [adopt, schedule]);
  const beginGesture = useCallback(() => { past.current.push(layoutRef.current); if (past.current.length > HISTORY) past.current.shift(); setCanUndo(true); }, []);
  const undo = useCallback(() => {
    const previous = past.current.pop();
    setCanUndo(past.current.length > 0);
    if (previous) { adopt(previous); schedule(); }
  }, [adopt, schedule]);

  // do not lose the last edits when the tab is hidden or closed
  useEffect(() => {
    const save = () => {
      if (!dirty.current || !idRef.current) return;
      void fetch(`/api/occasions/${idRef.current}/floor-plan`, { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: layoutRef.current, version: versionRef.current }) }).catch(() => {});
    };
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide); window.addEventListener('pagehide', save);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', save); if (timer.current) clearTimeout(timer.current); };
  }, []);

  return { layout, status, message, canUndo, apply, beginGesture, undo, reload: load };
}

// ---- seating actions shared by the canvas and the list view ------------------------------------------------------
export type AssignGuest = (guestId: string, tableId: string, tableName?: string) => void;
export type FloorPlan = ReturnType<typeof useFloorPlan>;

/** Puts a guest on a chair (taking them off any other chair first) and records it on the guest. */
export function seatGuest(plan: FloorPlan, assign: AssignGuest, guestId: string, chairId: string): 'ok' | 'missing' {
  const chair = plan.layout.chairs.find(c => c.id === chairId);
  if (!chair) return 'missing';
  const table = chair.tableId ? plan.layout.tables.find(t => t.id === chair.tableId) : undefined;
  const displaced = chair.guestId && chair.guestId !== guestId ? chair.guestId : null;
  plan.apply(layout => ({ ...layout, chairs: layout.chairs.map((c): PlanChair => (c.id === chairId ? { ...c, guestId } : c.guestId === guestId ? { ...c, guestId: null } : c)) }));
  if (displaced) assign(displaced, '', '');
  assign(guestId, table?.id ?? '', table?.name ?? '');
  return 'ok';
}
/** Seats a guest at the first free chair of a table. */
export function seatGuestAtTable(plan: FloorPlan, assign: AssignGuest, guestId: string, tableId: string): 'ok' | 'full' | 'missing' {
  if (!plan.layout.tables.some(t => t.id === tableId)) return 'missing';
  const free = seatsOf(plan.layout, tableId).find(c => !c.guestId || c.guestId === guestId);
  if (!free) return 'full';
  return seatGuest(plan, assign, guestId, free.id);
}
export function unseatGuest(plan: FloorPlan, assign: AssignGuest, guestId: string) {
  plan.apply(layout => ({ ...layout, chairs: layout.chairs.map(c => (c.guestId === guestId ? { ...c, guestId: null } : c)) }));
  assign(guestId, '', '');
}
