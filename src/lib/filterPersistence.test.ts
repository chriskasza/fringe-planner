import { describe, expect, it } from 'vitest';
import { decodeFilters, encodeFilters, loadInitialFilters, type FilterState } from './filterPersistence';
import { days as realDays, shows as realShows } from './loadData';
import { createInitialState } from './state';
import type { Day, Perf, Show } from './types';

function perf(timeId: number | string, day: string, start: number, status: Perf['status'] = 'active'): Perf {
  return { timeId: String(timeId), showId: '284247', day, start, end: start + 60, mins: 60, status };
}

function showWith(
  perfs: Perf[],
  id = '284247',
  overrides: Partial<Show> = {},
): Show {
  return {
    id,
    title: 'A Show',
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
    warnings: [],
    warningTags: [],
    mins: 60,
    cancelled: false,
    freeAdmission: false,
    salesEnded: false,
    timesIncomplete: false,
    perfs: perfs.map((p) => ({ ...p, showId: id })),
    ...overrides,
  };
}

function day(key: string, count = 1): Day {
  return { key, dow: 'THU', dateNum: Number(key.slice(-2)), label: key, count };
}

const NOW = { date: '2026-09-01', minutes: 600 }; // before every test day, so daysOn defaults all-on

const DAYS = [day('2026-09-03'), day('2026-09-04'), day('2026-09-05'), day('2026-09-06')];

function baseShows(): Show[] {
  return [
    showWith([perf(101, '2026-09-03', 840)], '1', { venue: 'Venue A', rating: 'PG', warningTags: ['violence'] }),
    showWith([perf(102, '2026-09-06', 1020)], '2', { venue: 'Venue B', rating: '14A', warningTags: ['nudity'] }),
  ];
}

function fresh(shows: Show[] = baseShows(), days: Day[] = DAYS): FilterState {
  return createInitialState(days, shows, NOW);
}

// createInitialState returns a full AppState; decodeFilters only returns the
// filter slice, so comparisons need to narrow to that same slice.
function filterSlice(state: FilterState): FilterState {
  const { daysOn, timeBucketsOn, venuesOn, ratingsOn, warningsOn, excluded, clash, query, sort } = state;
  return { daysOn, timeBucketsOn, venuesOn, ratingsOn, warningsOn, excluded, clash, query, sort };
}

describe('encodeFilters / decodeFilters', () => {
  it('round-trips several flipped fields and encodes only the deviations', () => {
    const shows = baseShows();
    const state = fresh(shows);
    const flipped: FilterState = {
      ...state,
      daysOn: { ...state.daysOn, '2026-09-06': false },
      timeBucketsOn: { ...state.timeBucketsOn, night: false },
      venuesOn: { ...state.venuesOn, 'Venue A': false },
      ratingsOn: { ...state.ratingsOn, PG: false },
      warningsOn: { ...state.warningsOn, nudity: false },
      excluded: { '1': true },
      clash: 'hide',
      query: 'comedy',
      sort: 'soonest',
    };

    const encoded = encodeFilters(flipped);
    const parsed = JSON.parse(encoded);
    expect(parsed).toEqual({
      v: 1,
      daysOff: ['2026-09-06'],
      timeBucketsOff: ['night'],
      venuesOff: ['Venue A'],
      ratingsOff: ['PG'],
      warningsOff: ['nudity'],
      excluded: ['1'],
      clash: 'hide',
      query: 'comedy',
      sort: 'soonest',
    });

    expect(decodeFilters(encoded, state, shows)).toEqual(filterSlice(flipped));
  });

  it('drops stale keys that no longer exist in the current data', () => {
    const before = baseShows();
    const encoded = encodeFilters({
      ...fresh(before),
      venuesOn: { ...fresh(before).venuesOn, 'Venue A': false },
      ratingsOn: { ...fresh(before).ratingsOn, PG: false },
      warningsOn: { ...fresh(before).warningsOn, violence: false },
      daysOn: { ...fresh(before).daysOn, '2026-09-03': false },
      excluded: { '1': true },
    });

    // Show 1 (Venue A / PG / violence) is gone, and day 09-03 no longer exists.
    const after = [showWith([perf(102, '2026-09-06', 1020)], '2', { venue: 'Venue B', rating: '14A' })];
    const afterDays = [day('2026-09-04'), day('2026-09-05'), day('2026-09-06')];
    const afterFresh = fresh(after, afterDays);

    const result = decodeFilters(encoded, afterFresh, after);
    expect(result.venuesOn).toEqual({ 'Venue B': true });
    expect(result.ratingsOn).toEqual({ '14A': true });
    expect(result.warningsOn).toEqual({});
    expect(result.daysOn).toEqual(afterFresh.daysOn);
    expect(result.excluded).toEqual({}); // showId '1' no longer present
  });

  it('defaults a brand-new venue/rating/warning/bucket to visible, not hidden', () => {
    const before = [showWith([perf(101, '2026-09-03', 840)], '1', { venue: 'Venue A', rating: 'PG' })];
    const encoded = encodeFilters(fresh(before)); // nothing flipped off

    const after = [
      ...before,
      showWith([perf(102, '2026-09-04', 900)], '2', { venue: 'Venue C', rating: '18A', warningTags: ['new-tag'] }),
    ];
    const afterFresh = fresh(after);
    const result = decodeFilters(encoded, afterFresh, after);

    expect(result.venuesOn['Venue C']).toBe(true);
    expect(result.ratingsOn['18A']).toBe(true);
    expect(result.warningsOn['new-tag']).toBe(true);
  });

  it('merges daysOn using the fresh date-dependent default, not a hardcoded true', () => {
    const shows = baseShows();
    const pastNow = { date: '2026-09-05', minutes: 600 };
    const savedState = createInitialState(DAYS, shows, pastNow); // Sep 3/4 are "past" here
    const encoded = encodeFilters(savedState); // no saved entry for any day

    // A day is only ever off by default because it's in the past - and once
    // past, always past - so a day off by default at save time must still
    // come back off later even though it's absent from the saved off-list,
    // while a day that was on by default must still come back on.
    const laterFresh = createInitialState([...DAYS, day('2026-09-07')], shows, pastNow);
    const result = decodeFilters(encoded, laterFresh, shows);
    expect(result.daysOn['2026-09-03']).toBe(false);
    expect(result.daysOn['2026-09-07']).toBe(true);
  });

  it('merges excluded ids without replacing unrelated ones', () => {
    const shows = [
      showWith([perf(101, '2026-09-03', 840)], '1'),
      showWith([perf(102, '2026-09-04', 900)], '2'),
    ];
    // '3' is stale (not in current shows); '1' is current and saved; '2' is
    // current but was never saved, so it should stay absent (not excluded).
    const encoded = JSON.stringify({ v: 1, excluded: ['1', '3'] });
    const result = decodeFilters(encoded, fresh(shows), shows);
    expect(result.excluded).toEqual({ '1': true });
  });

  it('falls back to fresh for empty, malformed, or wrong-shaped input', () => {
    const shows = baseShows();
    const state = fresh(shows);

    // Unparseable input returns `fresh` itself, unmodified.
    expect(decodeFilters('', state, shows)).toBe(state);
    expect(decodeFilters('{not json', state, shows)).toBe(state);
    expect(decodeFilters('[1,2,3]', state, shows)).toBe(state);

    const badShape = JSON.stringify({
      daysOff: 'not-an-array',
      excluded: [1, null, {}, '1'],
      clash: 'bogus',
      query: 42,
      sort: 'bogus',
    });
    const result = decodeFilters(badShape, state, shows);
    expect(result.daysOn).toEqual(state.daysOn); // bad daysOff falls back
    expect(result.excluded).toEqual({ '1': true }); // non-strings dropped, valid one kept
    expect(result.clash).toBe(state.clash); // bogus clash falls back
    expect(result.query).toBe(state.query); // non-string query falls back
    expect(result.sort).toBe(state.sort); // bogus sort falls back
  });

  it('round-trips each valid sort mode', () => {
    const shows = baseShows();
    const state = fresh(shows);
    for (const sort of ['random', 'title', 'soonest'] as const) {
      const encoded = encodeFilters({ ...state, sort });
      expect(decodeFilters(encoded, state, shows).sort).toBe(sort);
    }
  });

  it('round-trips against the real festival data', () => {
    const state = createInitialState(realDays, realShows);
    const flipped: FilterState = {
      ...state,
      venuesOn: { ...state.venuesOn, [realShows[0].venue]: false },
      ratingsOn: { ...state.ratingsOn, [realShows[0].rating]: false },
    };
    const encoded = encodeFilters(flipped);
    expect(decodeFilters(encoded, state, realShows)).toEqual(filterSlice(flipped));
  });
});

describe('loadInitialFilters', () => {
  it('falls back to fresh when localStorage has nothing stored', () => {
    const shows = baseShows();
    const state = fresh(shows);
    expect(loadInitialFilters(state, shows)).toEqual(state);
  });
});
