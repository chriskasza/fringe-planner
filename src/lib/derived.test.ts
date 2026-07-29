import { describe, expect, it } from 'vitest';
import { compareShowsBySoonest, nextActivePerf, visible } from './derived';
import type { Perf, Show } from './types';

function show(warningTags: string[], overrides: Partial<Show> = {}): Show {
  return {
    id: '1',
    title: 'APPLES!',
    blurb: '',
    poster: '',
    ticketUrl: '',
    venue: 'The Bus Stop Theatre',
    venueShort: 'BUS STOP',
    venueAddress: null,
    credits: [],
    rating: 'PG',
    warnings: warningTags,
    warningTags,
    mins: 60,
    salesEnded: false,
    timesIncomplete: false,
    perfs: [{ timeId: '1', showId: '1', day: '2026-09-03', start: 930, end: 990, mins: 60, status: 'active' }],
    ...overrides,
  };
}

function perf(overrides: Partial<Perf> = {}): Perf {
  return { timeId: '1', showId: '1', day: '2026-09-03', start: 930, end: 990, mins: 60, status: 'active', ...overrides };
}

const BASE_STATE = {
  excluded: {},
  daysOn: { '2026-09-03': true },
  timeBucketsOn: { matinee: true, evening: true, night: true },
  venuesOn: { 'The Bus Stop Theatre': true },
  ratingsOn: { PG: true },
  clash: 'show' as const,
  picked: new Set<string>(),
};

// Unlike Venue/Rating (one value per show), warnings is a list - visible()
// hides a show if ANY of its warnings has been switched off, and a show with
// no warnings is never affected by this filter.
describe('visible() content warnings gate', () => {
  it('is unaffected by the warnings filter when the show has none', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': false } };
    expect(visible(show([]), state, [])).toBe(true);
  });

  it('hides a show carrying a warning that has been switched off', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': false } };
    expect(visible(show(['flashing lights']), state, [])).toBe(false);
  });

  it('stays visible when all of its warnings are switched on', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': true, haze: true } };
    expect(visible(show(['flashing lights', 'haze']), state, [])).toBe(true);
  });

  it('hides a show if only one of its several warnings is switched off', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': true, haze: false } };
    expect(visible(show(['flashing lights', 'haze']), state, [])).toBe(false);
  });
});

describe('nextActivePerf', () => {
  const now = { date: '2026-09-05', minutes: 600 }; // 10:00 AM

  it('picks the first active perf that starts later today', () => {
    const s = show([], { perfs: [perf({ timeId: 'a', day: now.date, start: 900, end: 960 })] });
    expect(nextActivePerf(s, now)?.timeId).toBe('a');
  });

  it('picks a perf that started earlier today but hasn\'t ended yet', () => {
    const s = show([], { perfs: [perf({ timeId: 'a', day: now.date, start: 570, end: 630 })] });
    expect(nextActivePerf(s, now)?.timeId).toBe('a');
  });

  it('skips a perf that already ended today', () => {
    const s = show([], { perfs: [perf({ timeId: 'a', day: now.date, start: 480, end: 540 })] });
    expect(nextActivePerf(s, now)).toBeUndefined();
  });

  it('skips cancelled perfs even if they are upcoming', () => {
    const s = show([], {
      perfs: [perf({ timeId: 'a', day: now.date, start: 900, end: 960, status: 'cancelled' })],
    });
    expect(nextActivePerf(s, now)).toBeUndefined();
  });

  it('returns the earliest of several upcoming perfs, relying on perfs already being sorted', () => {
    const s = show([], {
      perfs: [
        perf({ timeId: 'a', day: '2026-09-06', start: 900, end: 960 }),
        perf({ timeId: 'b', day: '2026-09-07', start: 900, end: 960 }),
      ],
    });
    expect(nextActivePerf(s, now)?.timeId).toBe('a');
  });
});

describe('compareShowsBySoonest', () => {
  const now = { date: '2026-09-05', minutes: 600 }; // 10:00 AM

  it('orders by day then start time', () => {
    const earlier = show([], { title: 'B', perfs: [perf({ day: now.date, start: 900, end: 960 })] });
    const later = show([], { title: 'A', perfs: [perf({ day: now.date, start: 1200, end: 1260 })] });
    expect(compareShowsBySoonest(earlier, later, now)).toBeLessThan(0);
    expect(compareShowsBySoonest(later, earlier, now)).toBeGreaterThan(0);
  });

  it('falls back to title when two shows have the same next showtime', () => {
    const a = show([], { title: 'Aardvark', perfs: [perf({ day: now.date, start: 900, end: 960 })] });
    const b = show([], { title: 'Zebra', perfs: [perf({ day: now.date, start: 900, end: 960 })] });
    expect(compareShowsBySoonest(a, b, now)).toBeLessThan(0);
    expect(compareShowsBySoonest(b, a, now)).toBeGreaterThan(0);
  });

  it('treats a show currently in progress as upcoming, ahead of one that starts later', () => {
    const inProgress = show([], { title: 'Z', perfs: [perf({ day: now.date, start: 570, end: 630 })] });
    const future = show([], { title: 'A', perfs: [perf({ day: now.date, start: 900, end: 960 })] });
    expect(compareShowsBySoonest(inProgress, future, now)).toBeLessThan(0);
  });

  it('sorts a show with nothing upcoming after one that has something upcoming', () => {
    const past = show([], { title: 'A', perfs: [perf({ day: now.date, start: 480, end: 540 })] });
    const upcoming = show([], { title: 'Z', perfs: [perf({ day: now.date, start: 900, end: 960 })] });
    expect(compareShowsBySoonest(past, upcoming, now)).toBeGreaterThan(0);
  });

  it('falls back to title when neither show has anything upcoming', () => {
    const a = show([], { title: 'Aardvark', perfs: [perf({ day: now.date, start: 480, end: 540 })] });
    const b = show([], { title: 'Zebra', perfs: [perf({ day: now.date, start: 480, end: 540 })] });
    expect(compareShowsBySoonest(a, b, now)).toBeLessThan(0);
  });
});
