import { describe, expect, it } from 'vitest';
import { dayKeysBetween, FESTIVAL_FIRST_DAY, FESTIVAL_LAST_DAY, festivalDayKeys, TIME_BUCKETS, timeBucket } from './dates';
import { shows, shows as allShows } from './loadData';
import { createInitialState } from './state';

describe('time-of-day buckets', () => {
  const at = (h: number, m = 0) => h * 60 + m;

  it('splits at 5pm and 8pm', () => {
    expect(timeBucket(at(10, 30))).toBe('matinee');
    expect(timeBucket(at(16, 59))).toBe('matinee');
    expect(timeBucket(at(17))).toBe('evening');
    expect(timeBucket(at(19, 45))).toBe('evening');
    expect(timeBucket(at(20))).toBe('night');
    expect(timeBucket(at(21, 30))).toBe('night');
  });

  it('divides the real festival into three usefully-sized groups', () => {
    // The boundaries are fitted to the actual 2026 showtimes rather than
    // guessed - this pins that they still split the festival sensibly if the
    // data is re-scraped. The earlier four-bucket split had a "morning"
    // holding 5 performances and labelled 8pm - the single busiest slot -
    // as "late night".
    const counts = { matinee: 0, evening: 0, night: 0 };
    for (const s of shows) {
      for (const p of s.perfs) {
        if (p.status !== 'active') continue;
        counts[timeBucket(p.start)]++;
      }
    }

    const total = counts.matinee + counts.evening + counts.night;
    expect(total).toBe(282);
    // No bucket should be a rounding error or swallow everything.
    for (const key of TIME_BUCKETS.map((b) => b.key)) {
      expect(counts[key] / total).toBeGreaterThan(0.15);
      expect(counts[key] / total).toBeLessThan(0.6);
    }
  });

  it('labels each bucket with its own boundary so the filter needs no legend', () => {
    expect(TIME_BUCKETS.map((b) => b.label)).toEqual([
      'MATINEE · BEFORE 5PM',
      'EVENING · 5–8PM',
      'NIGHT · 8PM ON',
    ]);
  });
});

describe('festival day keys', () => {
  it('covers the 2026 festival inclusively', () => {
    const keys = festivalDayKeys();
    expect(keys.length).toBe(11);
    expect(keys[0]).toBe(FESTIVAL_FIRST_DAY);
    expect(keys[keys.length - 1]).toBe(FESTIVAL_LAST_DAY);
  });

  // The festival's dates move every year and won't always sit inside one
  // calendar month. Iterating the day-of-month number (as this used to do)
  // produces an empty list for a month-crossing range, which leaves the app
  // with no days at all and crashes it before first paint.
  it('crosses a month boundary', () => {
    expect(dayKeysBetween('2026-08-28', '2026-09-02')).toEqual([
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  it('crosses a year boundary and handles a leap day', () => {
    expect(dayKeysBetween('2027-12-30', '2028-01-02')).toEqual([
      '2027-12-30',
      '2027-12-31',
      '2028-01-01',
      '2028-01-02',
    ]);
    expect(dayKeysBetween('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('returns a single day when first and last are the same, and never an empty list', () => {
    expect(dayKeysBetween('2026-09-03', '2026-09-03')).toEqual(['2026-09-03']);
    // An inverted range is a config error; fail loudly rather than returning
    // [] and letting the app crash somewhere further downstream.
    expect(() => dayKeysBetween('2026-09-13', '2026-09-03')).toThrow(/before/);
  });
});

describe('past-day deselection', () => {
  // Build a fake set of festival days so the test doesn't depend on the
  // real show data, which might change.
  const days = [
    { key: '2026-09-03', dow: 'THU', dateNum: 3, label: 'Thu 3 Sep', count: 1 },
    { key: '2026-09-04', dow: 'FRI', dateNum: 4, label: 'Fri 4 Sep', count: 1 },
    { key: '2026-09-05', dow: 'SAT', dateNum: 5, label: 'Sat 5 Sep', count: 1 },
    { key: '2026-09-06', dow: 'SUN', dateNum: 6, label: 'Sun 6 Sep', count: 1 },
  ];

  it('selects all days when the festival has not started yet', () => {
    const now = { date: '2026-07-26', minutes: 720 };
    const s = createInitialState(days, allShows, now);
    for (const d of days) expect(s.daysOn[d.key]).toBe(true);
  });

  it('deselects days before today when the festival is underway', () => {
    const now = { date: '2026-09-05', minutes: 720 }; // midday Sat 5 Sep
    const s = createInitialState(days, allShows, now);
    expect(s.daysOn['2026-09-03']).toBe(false);
    expect(s.daysOn['2026-09-04']).toBe(false);
    expect(s.daysOn['2026-09-05']).toBe(true); // today
    expect(s.daysOn['2026-09-06']).toBe(true); // future
  });
});
