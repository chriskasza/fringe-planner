import type { Day, DayKey, TimeBucket } from './types';

// The festival runs Sep 3-13, 2026. No performances on Sep 7 (Labour Day), but
// it stays in the day strip at count 0 rather than being silently omitted.
export const FESTIVAL_FIRST_DAY = '2026-09-03';
export const FESTIVAL_LAST_DAY = '2026-09-13';

// Timestamps from show_times.json are naive Halifax local time ("2026-09-06T19:30"),
// never a real UTC instant - never hand these to `new Date()`. Split them by hand.
export function splitNaiveTimestamp(stamp: string): { date: DayKey; hh: number; mm: number } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(stamp);
  if (!m) throw new Error(`unparseable timestamp: ${stamp}`);
  return { date: m[1], hh: Number(m[2]), mm: Number(m[3]) };
}

export function minutesFromMidnight(hh: number, mm: number): number {
  return hh * 60 + mm;
}

// Building a Date from plain y/m/d integers (not from an API instant) is safe -
// the calendar weekday for a given date doesn't depend on the host's timezone.
function weekdayAbbrev(dateKey: DayKey): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toUpperCase();
}

function dayLabel(dateKey: DayKey): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
  const month = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' });
  return `${dow} ${d} ${month}`;
}

function toDayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Every date from `first` to `last`, inclusive. Stepping a Date built from
// plain y/m/d integers (never from an API instant - see splitNaiveTimestamp)
// is what makes month, year, and leap-day boundaries take care of themselves;
// iterating the day-of-month number instead only works while the whole range
// sits inside one month, which the festival's dates won't always do.
export function dayKeysBetween(first: DayKey, last: DayKey): DayKey[] {
  if (last < first) throw new Error(`festival last day ${last} is before first day ${first}`);

  const [y, m, d] = first.split('-').map(Number);
  const cursor = new Date(y, m - 1, d);
  const keys: DayKey[] = [];

  for (let key = toDayKey(cursor); key <= last; key = toDayKey(cursor)) {
    keys.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function festivalDayKeys(): DayKey[] {
  return dayKeysBetween(FESTIVAL_FIRST_DAY, FESTIVAL_LAST_DAY);
}

export function buildFestivalDays(counts: Record<DayKey, number>): Day[] {
  return festivalDayKeys().map((key) => {
    const [, , dStr] = key.split('-');
    return {
      key,
      dow: weekdayAbbrev(key),
      dateNum: Number(dStr),
      label: dayLabel(key),
      count: counts[key] ?? 0,
    };
  });
}

// `label` spells out the boundary so the filter panel needs no legend;
// `short` is what the filter *button* shows when exactly one bucket is
// picked, since the bar must not grow with the selection. See the TimeBucket
// comment for why these three and where the cut-offs come from.
export const TIME_BUCKETS: { key: TimeBucket; label: string; short: string }[] = [
  { key: 'matinee', label: 'MATINEE · BEFORE 5PM', short: 'MATINEE' },
  { key: 'evening', label: 'EVENING · 5–8PM', short: 'EVENING' },
  { key: 'night', label: 'NIGHT · 8PM ON', short: 'NIGHT' },
];

export function timeBucket(minutes: number): TimeBucket {
  if (minutes < 1020) return 'matinee'; // before 5pm
  if (minutes < 1200) return 'evening'; // before 8pm
  return 'night';
}

// The current instant, read back as Halifax *wall-clock* components via Intl -
// this is the one safe way to compare "now" against the naive local timestamps
// in show_times.json without ever parsing a date string by hand.
export function nowInHalifax(): { date: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = minutesFromMidnight(Number(get('hour')), Number(get('minute')));
  return { date, minutes };
}

// minutes-from-midnight -> "7:30 PM"
export function formatTime(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const hh24 = Math.floor(total / 60);
  const mm = total % 60;
  const period = hh24 < 12 ? 'AM' : 'PM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${String(mm).padStart(2, '0')} ${period}`;
}
