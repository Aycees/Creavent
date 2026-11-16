import { daysBetween, manilaParts } from './events.js';

// Dates and times are Manila dates ("2027-01-16") and times ("17:00"). They
// are formatted as calendar values, so a browser's own time zone never shifts
// them. Shared so emails read like the screens (design brief §4).
const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });

export function formatDay(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

// "17:00" → "5 PM", "12:30" → "12:30 PM".
export function formatTime(time: string) {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

export type Schedule = { startDate: string | null; endDate: string | null; opensAt: string | null; closesAt: string | null };

// An event's start and end instants as Manila dates and times.
export function scheduleOf(e: { startsAt: Date | string | null; endsAt: Date | string | null }): Schedule {
  const start = e.startsAt ? manilaParts(e.startsAt) : null;
  const end = e.endsAt ? manilaParts(e.endsAt) : null;
  return { startDate: start?.date ?? null, endDate: end?.date ?? null, opensAt: start?.time ?? null, closesAt: end?.time ?? null };
}

export function eventDays(s: Schedule) {
  return s.startDate && s.endDate ? daysBetween(s.startDate, s.endDate) + 1 : 0;
}

// "Sat, Jan 16 · 5 PM to 11 PM", or "Fri, Jan 15 to Sun, Jan 17 · 4 PM to
// 10 PM daily" for several days (spec §3.1.1).
export function formatSchedule(s: Schedule) {
  if (!s.startDate || !s.endDate || !s.opensAt || !s.closesAt) return null;
  const hours = `${formatTime(s.opensAt)} to ${formatTime(s.closesAt)}`;
  if (s.startDate === s.endDate) return `${formatDay(s.startDate)} · ${hours}`;
  return `${formatDay(s.startDate)} to ${formatDay(s.endDate)} · ${hours} daily`;
}
