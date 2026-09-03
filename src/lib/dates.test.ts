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
    // Not pinned to an exact number: the active count falls every day as
    // performances are played and retired to `ended`. A floor is enough to
    // catch the loop above silently counting nothing, which is all this
    // assertion was ever guarding - the bucket spread below is the real test.
    expect(total).toBeGreaterThan(100);
    // No bucket should be a rounding error or swallow everything.
    for (const key of TIME_BUCKETS.map((b) => b.key)) {
      expect(counts[key] / total).toBeGreaterThan(0.15);
      expect(counts[key] / total).toBeLessThan(0.6);
    }
  });

  it('labels each bucket with its own boundary so the filter needs no legend', () => {
    expect(TIME_BUCKETS.map((b) => b.label)).toEqual([
      'Matinee · before 5pm',
      'Evening · 5–8pm',
      'Night · 8pm on',
    ]);
  });
});

describe('festival day keys', () => {
  it('covers the 2026 festival inclusively', () => {
    const keys = festivalDayKeys();
    expect(keys.length).toBe(12);
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

// Past days used to load *deselected*, which hid the user's own history
// behind a filter they had to know to reopen. They load on now; orientation
// is gridDay's job instead (see 'initial grid day' below - the two together
// are the regression guard for "open on what's next, but keep the past
// reachable").
describe('day filter defaults', () => {
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

  it('leaves days before today switched on when the festival is underway', () => {
    const now = { date: '2026-09-05', minutes: 720 }; // midday Sat 5 Sep
    const s = createInitialState(days, allShows, now);
    for (const d of days) expect(s.daysOn[d.key]).toBe(true);
  });

  it('leaves every day switched on once the festival is over', () => {
    const s = createInitialState(days, allShows, { date: '2026-12-01', minutes: 720 });
    for (const d of days) expect(s.daysOn[d.key]).toBe(true);
  });
});

describe('initial grid day', () => {
  const day = (key: string, count: number) => ({
    key,
    dow: 'THU',
    dateNum: Number(key.slice(-2)),
    label: key,
    count,
  });

  it('opens on the first day with shows before the festival starts', () => {
    const days = [day('2026-09-03', 0), day('2026-09-04', 12), day('2026-09-05', 9)];
    const s = createInitialState(days, allShows, { date: '2026-07-26', minutes: 720 });
    expect(s.gridDay).toBe('2026-09-04');
  });

  // Now that every day loads switched on, this is the *only* thing orienting
  // the app forward: landing on Sep 3 on Sep 10 would open the planner on a
  // week-old day with nothing bookable on it.
  it('skips past days once the festival is underway', () => {
    const days = [day('2026-09-03', 12), day('2026-09-04', 12), day('2026-09-05', 9)];
    const s = createInitialState(days, allShows, { date: '2026-09-04', minutes: 720 });
    expect(s.gridDay).toBe('2026-09-04');
    expect(s.daysOn[s.gridDay]).toBe(true);
  });

  // Regression: `Day.count` briefly included played performances, which made a
  // day whose whole programme was over still look non-empty - so late on Sep 2
  // the app opened on Sep 2 rather than moving on to Sep 3. A day with nothing
  // left to see is not somewhere to land, however recently it was on.
  it('skips a today whose performances have all been played', () => {
    const days = [day('2026-09-02', 0), day('2026-09-03', 12)];
    const s = createInitialState(days, allShows, { date: '2026-09-02', minutes: 23 * 60 });
    expect(s.gridDay).toBe('2026-09-03');
  });

  it('skips today when today has no shows', () => {
    const days = [day('2026-09-03', 12), day('2026-09-04', 0), day('2026-09-05', 9)];
    const s = createInitialState(days, allShows, { date: '2026-09-04', minutes: 720 });
    expect(s.gridDay).toBe('2026-09-05');
  });

  it('falls back to the last day with shows once the festival is over', () => {
    const days = [day('2026-09-03', 12), day('2026-09-04', 12), day('2026-09-05', 0)];
    const s = createInitialState(days, allShows, { date: '2026-12-01', minutes: 720 });
    expect(s.gridDay).toBe('2026-09-04');
    expect(s.daysOn[s.gridDay]).toBe(true);
  });
});
