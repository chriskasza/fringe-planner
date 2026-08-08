import { describe, expect, it } from 'vitest';
import { appReducer, createInitialState, type AppState } from './state';
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
  venueShortMobile: 'BUS STOP',
  venueAddress: null,
  credits: [],
  rating: 'PG',
  warnings: ['flashing lights'],
  warningTags: ['flashing lights'],
  mins: 60,
  salesEnded: false,
  timesIncomplete: false,
  perfs: [perf('2026-09-03', 15 * 60 + 30), perf('2026-09-03', 20 * 60 + 30), perf('2026-09-04', 19 * 60)],
};

function initial(): AppState {
  return createInitialState(DAYS, [SHOW], { date: '2026-07-26', minutes: 720 });
}

describe('DetailPanel / MyFringePanel mutual exclusion', () => {
  it('SET_DETAIL with a target closes My Fringe', () => {
    const open = appReducer(initial(), { type: 'SET_MY_FRINGE_OPEN', open: true });
    const s = appReducer(open, { type: 'SET_DETAIL', detail: { timeId: 'x' } });
    expect(s.detail).toEqual({ timeId: 'x' });
    expect(s.myFringeOpen).toBe(false);
  });

  it('SET_MY_FRINGE_OPEN with open:true closes the detail panel', () => {
    const withDetail = appReducer(initial(), { type: 'SET_DETAIL', detail: { timeId: 'x' } });
    const s = appReducer(withDetail, { type: 'SET_MY_FRINGE_OPEN', open: true });
    expect(s.myFringeOpen).toBe(true);
    expect(s.detail).toBeNull();
  });

  it('closing one leaves the other alone', () => {
    const withDetail = appReducer(initial(), { type: 'SET_DETAIL', detail: { timeId: 'x' } });
    const s = appReducer(withDetail, { type: 'SET_DETAIL', detail: null });
    expect(s.detail).toBeNull();
    expect(s.myFringeOpen).toBe(false);

    const open = appReducer(initial(), { type: 'SET_MY_FRINGE_OPEN', open: true });
    const closed = appReducer(open, { type: 'SET_MY_FRINGE_OPEN', open: false });
    expect(closed.myFringeOpen).toBe(false);
    expect(closed.detail).toBeNull();
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
