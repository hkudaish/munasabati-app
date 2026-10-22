import type { PolicySchedule } from './types';

export const DEFAULT_TZ = 'Asia/Riyadh';
const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const dayOfWeek = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay();
const shiftDay = (date: string, delta: number) => new Date(Date.parse(date + 'T00:00:00Z') + delta * 86400000).toISOString().slice(0, 10);

/** The wall-clock date and time of an instant in a time zone. */
export function localParts(at: Date, timeZone = DEFAULT_TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
const enabled = (s: PolicySchedule) => s.isEnabled !== false;
const inDates = (s: PolicySchedule, date: string) => (!s.startDate || date >= s.startDate) && (!s.endDate || date <= s.endDate);

/** Does an OPERATING window cover a date (and a time, when given)? Overnight windows (22:00-02:00) run into the next day. */
export function windowCovers(s: PolicySchedule, date: string, time?: string | null): boolean {
  const start = s.startTime ? toMinutes(s.startTime) : 0, end = s.endTime ? toMinutes(s.endTime) : 1440;
  const overnight = !!s.startTime && !!s.endTime && s.endTime !== '24:00' && end <= start;
  const dayMatches = (d: string) => (s.dayOfWeek == null || s.dayOfWeek === dayOfWeek(d)) && inDates(s, d);
  if (time == null) return dayMatches(date) || (overnight && dayMatches(shiftDay(date, -1)));
  const t = toMinutes(time);
  if (!overnight) return dayMatches(date) && t >= start && t < end;
  return (dayMatches(date) && t >= start) || (dayMatches(shiftDay(date, -1)) && t < end);
}
export function operatingWindows(schedules: PolicySchedule[]) { return schedules.filter(s => s.kind === 'OPERATING' && enabled(s)); }
/** null: the schedule says nothing about operating hours; otherwise whether the date/time is inside one of the windows. */
export function withinOperatingHours(schedules: PolicySchedule[], date: string, time?: string | null): boolean | null {
  const windows = operatingWindows(schedules);
  if (!windows.length) return null;
  return windows.some(w => windowCovers(w, date, time));
}
/** A closure (EXCEPTION or HOLIDAY) that covers the date, or the date and time when the closure has hours. */
export function closedAt(schedules: PolicySchedule[], date: string, time?: string | null): PolicySchedule | null {
  for (const s of schedules) {
    if (!enabled(s) || (s.kind !== 'EXCEPTION' && s.kind !== 'HOLIDAY')) continue;
    if (!s.startDate || date < s.startDate || date > (s.endDate ?? s.startDate)) continue;
    if (!s.startTime && !s.endTime) return s;
    if (time != null && (!s.startTime || time >= s.startTime) && (!s.endTime || s.endTime === '24:00' || time < s.endTime)) return s;
  }
  return null;
}
/** A scheduled maintenance window that is running at this instant. */
export function maintenanceAt(schedules: PolicySchedule[], now: Date): PolicySchedule | null {
  for (const s of schedules) {
    if (!enabled(s) || s.kind !== 'MAINTENANCE' || !s.startDate) continue;
    const local = localParts(now, s.timezone || DEFAULT_TZ);
    const startKey = `${s.startDate}T${s.startTime ?? '00:00'}`, endDate = s.endDate ?? s.startDate, endKey = `${endDate}T${s.endTime && s.endTime !== '24:00' ? s.endTime : s.endTime === '24:00' ? '23:59' : '23:59'}`;
    const key = `${local.date}T${local.time}`;
    if (key >= startKey && key <= endKey) return s;
  }
  return null;
}
/** The smallest daily booking cap of the OPERATING windows that cover the date, or null when there is none. */
export function scheduleCap(schedules: PolicySchedule[], date: string, time?: string | null): number | null {
  const caps = operatingWindows(schedules).filter(w => w.maxBookings != null && windowCovers(w, date, time)).map(w => w.maxBookings as number);
  return caps.length ? Math.min(...caps) : null;
}
export function inTimeSlot(slots: string[], time: string): boolean {
  return slots.some(slot => { const [from, to] = slot.split('-'); return time >= from && time < to; });
}
