// Hall floor plan: the model, the geometry and the validation, shared by the editor (browser) and the API (server).
// Everything lives in "canvas units": the hall is CANVAS.w x CANVAS.h units and the editor scales it to the screen.

export const CANVAS = { w: 1000, h: 640 } as const;
export const CHAIR = 20; // chair size in units
const CHAIR_GAP = 8; // space between a table edge and its chairs

export const SHAPES = ['round', 'oval', 'square', 'rectangle', 'banquet'] as const;
export const SIZES = ['small', 'medium', 'large'] as const;
export const SECTIONS = ['women', 'men', 'vip', 'general'] as const;
export type Shape = (typeof SHAPES)[number];
export type Size = (typeof SIZES)[number];
export type Section = (typeof SECTIONS)[number];
export type Rotation = 0 | 90 | 180 | 270;

export const SHAPE_LABEL: Record<Shape, string> = { round: 'دائرية', oval: 'بيضاوية', square: 'مربعة', rectangle: 'مستطيلة', banquet: 'طويلة (بوفيه)' };
export const SIZE_LABEL: Record<Size, string> = { small: 'صغيرة', medium: 'متوسطة', large: 'كبيرة' };
export const SECTION_LABEL: Record<Section, string> = { women: 'النساء', men: 'الرجال', vip: 'VIP', general: 'عام' };

/** Table body size and default number of chairs, per type and size. */
export const DIMENSIONS: Record<Shape, Record<Size, { w: number; h: number; seats: number }>> = {
  round: { small: { w: 70, h: 70, seats: 6 }, medium: { w: 96, h: 96, seats: 8 }, large: { w: 128, h: 128, seats: 12 } },
  oval: { small: { w: 110, h: 70, seats: 8 }, medium: { w: 150, h: 90, seats: 10 }, large: { w: 190, h: 110, seats: 14 } },
  square: { small: { w: 70, h: 70, seats: 4 }, medium: { w: 90, h: 90, seats: 6 }, large: { w: 112, h: 112, seats: 8 } },
  rectangle: { small: { w: 100, h: 60, seats: 6 }, medium: { w: 140, h: 70, seats: 8 }, large: { w: 190, h: 80, seats: 10 } },
  banquet: { small: { w: 220, h: 44, seats: 10 }, medium: { w: 300, h: 50, seats: 14 }, large: { w: 380, h: 56, seats: 18 } },
};

export interface PlanTable { id: string; name: string; shape: Shape; size: Size; section: Section; x: number; y: number; rot: Rotation }
export interface PlanChair { id: string; tableId: string | null; x: number; y: number; guestId: string | null }
export interface Layout { v: 1; tables: PlanTable[]; chairs: PlanChair[] }

export const MAX_TABLES = 150;
export const MAX_CHAIRS = 1500;
export const MAX_SEATS_PER_TABLE = 30;
export const emptyLayout = (): Layout => ({ v: 1, tables: [], chairs: [] });

export const newId = (prefix: 't' | 'c') => prefix + '_' + Math.random().toString(36).slice(2, 10);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Width and height of the table as drawn (a quarter turn swaps them). */
export function tableBox(t: Pick<PlanTable, 'shape' | 'size' | 'rot'>) {
  const d = DIMENSIONS[t.shape][t.size];
  return t.rot === 90 || t.rot === 270 ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}
export const defaultSeats = (t: Pick<PlanTable, 'shape' | 'size'>) => DIMENSIONS[t.shape][t.size].seats;

/** Where `count` chairs sit around a table (absolute canvas positions), evenly spaced. */
export function chairSlots(t: PlanTable, count: number): { x: number; y: number }[] {
  const d = DIMENSIONS[t.shape][t.size];
  const out: { x: number; y: number }[] = [];
  const reach = CHAIR / 2 + CHAIR_GAP;
  const a = d.w / 2 + reach, b = d.h / 2 + reach;
  for (let i = 0; i < count; i++) {
    let dx: number, dy: number;
    if (t.shape === 'round' || t.shape === 'oval') {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      dx = Math.cos(angle) * a; dy = Math.sin(angle) * b;
    } else {
      // walk clockwise along the rectangle around the table, starting at the top-left corner
      const perimeter = 4 * (a + b);
      let s = ((i + 0.5) * perimeter) / count;
      const top = 2 * a, right = 2 * b;
      if (s < top) { dx = -a + s; dy = -b; }
      else if ((s -= top) < right) { dx = a; dy = -b + s; }
      else if ((s -= right) < top) { dx = a - s; dy = b; }
      else { s -= top; dx = -a; dy = b - s; }
    }
    // the table may be turned: turn the ring with it
    const [rx, ry] = t.rot === 90 ? [-dy, dx] : t.rot === 180 ? [-dx, -dy] : t.rot === 270 ? [dy, -dx] : [dx, dy];
    out.push({ x: round1(clamp(t.x + rx, CHAIR / 2, CANVAS.w - CHAIR / 2)), y: round1(clamp(t.y + ry, CHAIR / 2, CANVAS.h - CHAIR / 2)) });
  }
  return out;
}

/** The table a dropped chair belongs to: the nearest one whose area (plus a chair's reach) contains the point. */
export function tableAt(point: { x: number; y: number }, tables: PlanTable[], margin = CHAIR * 2): PlanTable | null {
  let best: { t: PlanTable; score: number } | null = null;
  for (const t of tables) {
    const { w, h } = tableBox(t);
    const nx = Math.abs(point.x - t.x) / (w / 2 + margin), ny = Math.abs(point.y - t.y) / (h / 2 + margin);
    if (nx > 1 || ny > 1) continue;
    const score = nx * nx + ny * ny;
    if (!best || score < best.score) best = { t, score };
  }
  return best ? best.t : null;
}

/** A table with its chairs placed around it, ready to add to a layout. */
export function makeTable(shape: Shape, size: Size, at: { x: number; y: number }, name: string, section: Section = 'general', seats?: number): { table: PlanTable; chairs: PlanChair[] } {
  const { w, h } = tableBox({ shape, size, rot: 0 });
  const table: PlanTable = { id: newId('t'), name, shape, size, section, rot: 0, x: round1(clamp(at.x, w / 2 + CHAIR * 2, CANVAS.w - w / 2 - CHAIR * 2)), y: round1(clamp(at.y, h / 2 + CHAIR * 2, CANVAS.h - h / 2 - CHAIR * 2)) };
  const slots = chairSlots(table, seats ?? defaultSeats(table));
  return { table, chairs: slots.map(s => ({ id: newId('c'), tableId: table.id, x: s.x, y: s.y, guestId: null })) };
}

/** Re-seats a table's chairs around it (after a change of shape, size, turn or seat count) keeping who sits on which chair. */
export function arrangeChairs(layout: Layout, tableId: string, count?: number): Layout {
  const table = layout.tables.find(t => t.id === tableId);
  if (!table) return layout;
  const own = layout.chairs.filter(c => c.tableId === tableId);
  const n = clamp(count ?? own.length, 1, MAX_SEATS_PER_TABLE);
  const slots = chairSlots(table, n);
  const seated = own.filter(c => c.guestId), empty = own.filter(c => !c.guestId);
  const ordered = [...seated, ...empty].slice(0, n); // when shrinking, empty chairs go first
  const kept = ordered.map((c, i) => ({ ...c, x: slots[i].x, y: slots[i].y }));
  while (kept.length < n) kept.push({ id: newId('c'), tableId, x: slots[kept.length].x, y: slots[kept.length].y, guestId: null });
  return { ...layout, chairs: [...layout.chairs.filter(c => c.tableId !== tableId), ...kept] };
}

export const seatsOf = (layout: Layout, tableId: string) => layout.chairs.filter(c => c.tableId === tableId);
export const seatedGuestIds = (layout: Layout) => new Set(layout.chairs.map(c => c.guestId).filter(Boolean) as string[]);

// ---------------------------------------------------------------------------------------------------------------
// Validation: the API accepts only a well-formed document; the editor runs the same code on what it loads.
// ---------------------------------------------------------------------------------------------------------------
export class LayoutError extends Error {}
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const num = (v: unknown, what: string) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new LayoutError(what + ' غير صالح'); return v; };
const oneOf = <T extends string>(v: unknown, list: readonly T[], what: string): T => { if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) throw new LayoutError(what + ' غير صالح'); return v as T; };

export function sanitizeLayout(input: unknown): Layout {
  if (!input || typeof input !== 'object') throw new LayoutError('المخطط غير صالح');
  const raw = input as { v?: unknown; tables?: unknown; chairs?: unknown };
  if (raw.v !== 1 || !Array.isArray(raw.tables) || !Array.isArray(raw.chairs)) throw new LayoutError('صيغة المخطط غير مدعومة');
  if (raw.tables.length > MAX_TABLES) throw new LayoutError(`الحد الأقصى ${MAX_TABLES} طاولة`);
  if (raw.chairs.length > MAX_CHAIRS) throw new LayoutError(`الحد الأقصى ${MAX_CHAIRS} مقعد`);
  const ids = new Set<string>();
  const unique = (id: unknown, what: string) => { if (typeof id !== 'string' || !ID.test(id) || ids.has(id)) throw new LayoutError('معرّف ' + what + ' غير صالح أو مكرر'); ids.add(id); return id; };
  const tables: PlanTable[] = raw.tables.map((t: any) => {
    if (!t || typeof t !== 'object') throw new LayoutError('طاولة غير صالحة');
    const name = typeof t.name === 'string' ? t.name.trim().slice(0, 60) : '';
    if (!name) throw new LayoutError('لكل طاولة اسم');
    const rot = num(t.rot, 'الدوران');
    if (![0, 90, 180, 270].includes(rot)) throw new LayoutError('الدوران غير صالح');
    return { id: unique(t.id, 'طاولة'), name, shape: oneOf(t.shape, SHAPES, 'شكل الطاولة'), size: oneOf(t.size, SIZES, 'حجم الطاولة'), section: oneOf(t.section, SECTIONS, 'القسم'), rot: rot as Rotation, x: round1(clamp(num(t.x, 'الموضع'), 0, CANVAS.w)), y: round1(clamp(num(t.y, 'الموضع'), 0, CANVAS.h)) };
  });
  const tableIds = new Set(tables.map(t => t.id));
  const perTable = new Map<string, number>();
  const guests = new Set<string>();
  const chairs: PlanChair[] = raw.chairs.map((c: any) => {
    if (!c || typeof c !== 'object') throw new LayoutError('مقعد غير صالح');
    const tableId = c.tableId === null || c.tableId === undefined ? null : String(c.tableId);
    if (tableId !== null && !tableIds.has(tableId)) throw new LayoutError('مقعد يشير إلى طاولة غير موجودة');
    if (tableId) { const n = (perTable.get(tableId) || 0) + 1; if (n > MAX_SEATS_PER_TABLE) throw new LayoutError(`الحد الأقصى ${MAX_SEATS_PER_TABLE} مقعد للطاولة`); perTable.set(tableId, n); }
    let guestId: string | null = null;
    if (c.guestId !== null && c.guestId !== undefined) {
      if (typeof c.guestId !== 'string' || !c.guestId || c.guestId.length > 100) throw new LayoutError('معرّف الضيف غير صالح');
      if (guests.has(c.guestId)) throw new LayoutError('الضيف معيّن على أكثر من مقعد');
      guests.add(c.guestId); guestId = c.guestId;
    }
    return { id: unique(c.id, 'مقعد'), tableId, guestId, x: round1(clamp(num(c.x, 'الموضع'), 0, CANVAS.w)), y: round1(clamp(num(c.y, 'الموضع'), 0, CANVAS.h)) };
  });
  return { v: 1, tables, chairs };
}
