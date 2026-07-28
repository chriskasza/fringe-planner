import { describe, expect, it } from 'vitest';
import { appReducer, createInitialState, type AppState } from './state';
import { perfInFilter } from './derived';
import type { Day, Perf, Show } from './types';

const DAYS: Day[] = [
  { key: '2026-09-03', dow: 'THU', dateNum: 3, label: 'Thu 3 Sep', count: 2 },
  { key: '2026-09-04', dow: 'FRI', dateNum: 4, label: 'Fri 4 Sep', count: 1 },
];

// One matinee and one night performance on Sep 3, plus one on Sep 4 - enough
// to tell the day filter and the time-bucket filter apart.
function perf(day: string, start: number): Perf {
  return { timeId: `${day}-${start}`, showId: '1', day, start, end: start + 60, mins: 60, status: 'active' };
}

const SHOW: Show = {
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
  warnings: ['flashing lights'],
  mins: 60,
  salesEnded: false,
  timesIncomplete: false,
  perfs: [perf('2026-09-03', 15 * 60 + 30), perf('2026-09-03', 20 * 60 + 30), perf('2026-09-04', 19 * 60)],
};

function initial(): AppState {
  return createInitialState(DAYS, [SHOW], { date: '2026-07-26', minutes: 720 });
}

const key = (day: string, start: number) => `${day}-${start}`;

describe('TOGGLE_SHOW_STAR', () => {
  it('picks every active performance when nothing is filtered out', () => {
    const s = appReducer(initial(), { type: 'TOGGLE_SHOW_STAR', show: SHOW });
    expect([...s.picked].sort()).toEqual(
      [key('2026-09-03', 930), key('2026-09-03', 1230), key('2026-09-04', 1140)].sort(),
    );
  });

  it('unstars every performance of the show when any is already picked', () => {
    const starred = appReducer(initial(), { type: 'TOGGLE_SHOW_STAR', show: SHOW });
    const s = appReducer(starred, { type: 'TOGGLE_SHOW_STAR', show: SHOW });
    expect(s.picked.size).toBe(0);
  });

  it('skips performances on a deselected day', () => {
    const off = appReducer(initial(), { type: 'SET_DAY_ON', day: '2026-09-04', on: false });
    const s = appReducer(off, { type: 'TOGGLE_SHOW_STAR', show: SHOW });
    expect(s.picked.has(key('2026-09-04', 1140))).toBe(false);
    expect(s.picked.size).toBe(2);
  });

  // The star used to gate on daysOn alone while the cards, time pills and My
  // Fringe rail all gate on perfInFilter (day *and* time bucket), so starring
  // a show with the MATINEE bucket off added a 15:30 pick that had no pill on
  // the card and rendered dimmed as "OUTSIDE DATE FILTER" in the rail.
  it('skips performances in a deselected time bucket', () => {
    const off = appReducer(initial(), { type: 'SET_TIME_BUCKET_ON', bucket: 'matinee', on: false });
    const s = appReducer(off, { type: 'TOGGLE_SHOW_STAR', show: SHOW });
    expect(s.picked.has(key('2026-09-03', 930))).toBe(false);
    expect(s.picked.has(key('2026-09-03', 1230))).toBe(true);
    expect(s.picked.has(key('2026-09-04', 1140))).toBe(true);
  });

  it('only ever picks performances the rest of the UI agrees are in filter', () => {
    const off = appReducer(initial(), { type: 'SET_TIME_BUCKET_ON', bucket: 'night', on: false });
    const s = appReducer(off, { type: 'TOGGLE_SHOW_STAR', show: SHOW });
    for (const timeId of s.picked) {
      const perf = SHOW.perfs.find((p) => p.timeId === timeId)!;
      expect(perfInFilter(perf, s.daysOn, s.timeBucketsOn)).toBe(true);
    }
  });
});

describe('SET_GRID_DAY', () => {
  it('switches its own day on without disturbing the other days', () => {
    const off = appReducer(initial(), { type: 'SET_DAY_ON', day: '2026-09-04', on: false });
    const s = appReducer(off, { type: 'SET_GRID_DAY', day: '2026-09-04' });
    expect(s.gridDay).toBe('2026-09-04');
    expect(s.daysOn['2026-09-04']).toBe(true);
    expect(s.daysOn['2026-09-03']).toBe(true);
  });
});

describe('content warnings filter', () => {
  it('defaults every distinct warning across shows to on', () => {
    expect(initial().warningsOn).toEqual({ 'flashing lights': true });
  });

  it('SET_WARNING_ON toggles a single warning', () => {
    const s = appReducer(initial(), { type: 'SET_WARNING_ON', warning: 'flashing lights', on: false });
    expect(s.warningsOn['flashing lights']).toBe(false);
  });

  it('SET_ALL_WARNINGS sets every given warning at once', () => {
    const s = appReducer(initial(), { type: 'SET_ALL_WARNINGS', warnings: ['flashing lights'], on: false });
    expect(s.warningsOn['flashing lights']).toBe(false);
  });

  it('RESET_ALL_FILTERS switches every warning back on', () => {
    const off = appReducer(initial(), { type: 'SET_WARNING_ON', warning: 'flashing lights', on: false });
    const s = appReducer(off, {
      type: 'RESET_ALL_FILTERS',
      days: ['2026-09-03', '2026-09-04'],
      venues: ['The Bus Stop Theatre'],
      ratings: ['PG'],
      warnings: ['flashing lights'],
    });
    expect(s.warningsOn['flashing lights']).toBe(true);
  });
});
