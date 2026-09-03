import { describe, expect, it } from 'vitest';
import { compareShowsBySoonest, isPastPerf, isPlayed, matchesQuery, nextActivePerf, notCancelled, visible } from './derived';
import type { Perf, Show } from './types';

function show(warningTags: string[], overrides: Partial<Show> = {}): Show {
  return {
    id: '1',
    title: 'APPLES!',
    blurb: '',
    description: [],
    poster: '',
    ticketUrl: '',
    venue: 'The Bus Stop Theatre',
    venueShort: 'BUS STOP',
    venueShortMobile: 'BUS STOP',
    venueAddress: null,
    credits: [],
    rating: 'PG',
    warnings: warningTags,
    warningTags,
    mins: 60,
    cancelled: false,
    freeAdmission: false,
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

// A cancelled show has no active perfs and no dates worth matching, so the
// day/time gate can never pass for it. It's kept listed for posterity, but the
// filters that describe the show itself still apply.
describe('visible() cancelled shows', () => {
  const cancelledShow = (overrides: Partial<Show> = {}) =>
    show([], {
      cancelled: true,
      perfs: [{ timeId: '1', showId: '1', day: '2026-09-03', start: 930, end: 990, mins: 60, status: 'cancelled' }],
      ...overrides,
    });
  const warningsOn = { 'flashing lights': true };

  it('stays visible when the day filter excludes its only date', () => {
    const state = { ...BASE_STATE, warningsOn, daysOn: { '2026-09-03': false } };
    expect(visible(cancelledShow(), state, [])).toBe(true);
    // Same show, not cancelled: the day gate rejects it, so the case is real.
    expect(visible(show([]), state, [])).toBe(false);
  });

  it('stays visible when every time bucket is switched off', () => {
    const state = {
      ...BASE_STATE,
      warningsOn,
      timeBucketsOn: { matinee: false, evening: false, night: false },
    };
    expect(visible(cancelledShow(), state, [])).toBe(true);
  });

  it('still respects venue, rating, warnings and the Shows exclusion list', () => {
    const base = { ...BASE_STATE, warningsOn };
    expect(visible(cancelledShow(), { ...base, venuesOn: { 'The Bus Stop Theatre': false } }, [])).toBe(false);
    expect(visible(cancelledShow(), { ...base, ratingsOn: { PG: false } }, [])).toBe(false);
    expect(visible(cancelledShow({ warningTags: ['flashing lights'] }), { ...base, warningsOn: { 'flashing lights': false } }, [])).toBe(false);
    expect(visible(cancelledShow(), { ...base, excluded: { '1': true } }, [])).toBe(false);
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

describe('matchesQuery', () => {
  // The scraper strips the "FREE - " prefix upstream puts on these titles, so
  // the only thing left to match on is the flag.
  it('finds a free show by the word "free" even though its title no longer says so', () => {
    const free = show([], { title: 'Late Night Cabaret', freeAdmission: true });
    expect(matchesQuery(free, 'free')).toBe(true);
    expect(matchesQuery(free, 'FRE')).toBe(true);
  });

  it('does not match every show on "free"', () => {
    expect(matchesQuery(show([]), 'free')).toBe(false);
  });

  it('still matches on title and venue', () => {
    expect(matchesQuery(show([]), 'apples')).toBe(true);
    expect(matchesQuery(show([]), 'bus stop')).toBe(true);
    expect(matchesQuery(show([]), 'nothing here')).toBe(false);
  });
});

// Moved here with isPastPerf itself: `lib` can't import from `components`,
// and isPlayed composes it.
describe('isPastPerf', () => {
  const DAY = '2026-09-05';
  const at = (h: number, m = 0) => h * 60 + m;
  const now = { date: DAY, minutes: at(20) };

  it('is true only for a performance that has already ended today', () => {
    expect(isPastPerf({ day: DAY, end: at(19, 59) }, now)).toBe(true);
    expect(isPastPerf({ day: DAY, end: at(20) }, now)).toBe(true); // ends exactly now
    expect(isPastPerf({ day: DAY, end: at(20, 1) }, now)).toBe(false); // still running
    expect(isPastPerf({ day: '2026-09-04', end: at(19) }, now)).toBe(false); // another day
    expect(isPastPerf({ day: '2026-09-06', end: at(19) }, now)).toBe(false);
  });

  it('handles a performance running past midnight, encoded as end > 1440', () => {
    expect(isPastPerf({ day: DAY, end: 1470 }, { date: DAY, minutes: at(23, 45) })).toBe(false);
  });
});

describe('isPlayed', () => {
  const DAY = '2026-09-05';
  const at = (h: number, m = 0) => h * 60 + m;

  // Two signals for the same event at different lags: the clock knows as soon
  // as the performance ends, the scraper only on its next run.
  it('is true from the clock alone, before the scraper has caught up', () => {
    const p = perf({ day: DAY, start: at(14), end: at(15), status: 'active' });
    expect(isPlayed(p, { date: DAY, minutes: at(16) })).toBe(true);
    expect(isPlayed(p, { date: DAY, minutes: at(14, 30) })).toBe(false); // still running
  });

  it('is true from the scraper alone, whatever the clock says', () => {
    const p = perf({ day: DAY, start: at(14), end: at(15), status: 'ended' });
    expect(isPlayed(p, { date: '2026-09-01', minutes: at(9) })).toBe(true);
  });

  it('is false for a cancelled performance - it never happened, it was not played', () => {
    const p = perf({ day: DAY, start: at(14), end: at(15), status: 'cancelled' });
    expect(isPlayed(p, { date: '2026-09-01', minutes: at(9) })).toBe(false);
  });

  it('handles a performance running past midnight, encoded as end > 1440', () => {
    const p = perf({ day: DAY, start: at(23), end: 1470, status: 'active' });
    expect(isPlayed(p, { date: DAY, minutes: at(23, 45) })).toBe(false);
  });
});

describe('notCancelled', () => {
  // The whole point of the split: an ended performance is history worth
  // keeping on the board, a cancelled one is not.
  it('keeps active and ended, drops cancelled', () => {
    expect(notCancelled(perf({ status: 'active' }))).toBe(true);
    expect(notCancelled(perf({ status: 'ended' }))).toBe(true);
    expect(notCancelled(perf({ status: 'cancelled' }))).toBe(false);
  });
});

describe('visible() and a show whose whole run has been played', () => {
  // The show has no *active* perf left, so a day/time gate testing for one
  // would reject it under every filter setting and it would drop off the
  // board along with the user's picks on it.
  const played = show([], {
    perfs: [{ timeId: '1', showId: '1', day: '2026-09-03', start: 930, end: 990, mins: 60, status: 'ended' }],
  });

  it('stays visible with its day switched on', () => {
    expect(visible(played, { ...BASE_STATE, warningsOn: {} }, [played])).toBe(true);
  });

  it('still drops out when its day is switched off', () => {
    expect(visible(played, { ...BASE_STATE, warningsOn: {}, daysOn: { '2026-09-03': false } }, [played])).toBe(false);
  });
});
