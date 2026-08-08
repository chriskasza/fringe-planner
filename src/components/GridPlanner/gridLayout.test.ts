import { describe, expect, it } from 'vitest';
import { blockLeft, gridTimeBounds, isPastPerf, SLOT_WIDTH } from './gridLayout';
import type { Perf, Show } from '../../lib/types';

const DAY = '2026-09-05';

function show(perfs: [start: number, end: number][], day = DAY, status: Perf['status'] = 'active'): Show {
  return {
    id: '1',
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
    salesEnded: false,
    timesIncomplete: false,
    perfs: perfs.map(([start, end], i) => ({
      timeId: String(i),
      showId: '1',
      day,
      start,
      end,
      mins: end - start,
      status,
    })),
  };
}

const at = (h: number, m = 0) => h * 60 + m;

describe('gridTimeBounds', () => {
  it('spans the whole day on a day that is not today', () => {
    const shows = [show([[at(14), at(15, 30)], [at(20), at(21)]])];
    const { startMin, endMin, slots } = gridTimeBounds(shows, DAY, { date: '2026-09-04', minutes: at(20) });
    expect(startMin).toBe(at(14));
    expect(endMin).toBe(at(21));
    expect(slots[0]).toBe(at(14));
    expect(slots[slots.length - 1]).toBe(at(20, 30));
  });

  it('shows a past day in full, so the user can look back', () => {
    const shows = [show([[at(14), at(15, 30)]])];
    const { startMin, slots } = gridTimeBounds(shows, DAY, { date: '2026-09-06', minutes: at(11) });
    expect(startMin).toBe(at(14));
    expect(slots.length).toBeGreaterThan(0);
  });

  it('drops finished performances from today but keeps one that is still running', () => {
    const shows = [
      show([
        [at(14), at(15, 30)], // over
        [at(19, 30), at(21)], // running at 20:00
        [at(22), at(23)], // still to come
      ]),
    ];
    const { startMin, endMin } = gridTimeBounds(shows, DAY, { date: DAY, minutes: at(20) });
    expect(startMin).toBe(at(19, 30));
    expect(endMin).toBe(at(23));
  });

  // Clipping the axis to `now` while leaving `max` alone produced
  // startMin > endMin late in the evening: the slot loop yielded nothing, so
  // the day rendered as venue rows with no axis and nothing in them.
  it('never produces an axis that starts after it ends', () => {
    const shows = [show([[at(14), at(22, 30)]])];
    for (const minutes of [at(0), at(14), at(20), at(22, 30), at(23), at(23, 59)]) {
      const { startMin, endMin, slots } = gridTimeBounds(shows, DAY, { date: DAY, minutes });
      expect(endMin).toBeGreaterThan(startMin);
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe(startMin);
    }
  });

  it('falls back to harmless bounds when the day has nothing left to show', () => {
    const shows = [show([[at(14), at(15)]])];
    const { startMin, endMin, slots } = gridTimeBounds(shows, DAY, { date: DAY, minutes: at(23) });
    expect(endMin).toBeGreaterThan(startMin);
    expect(slots.length).toBe(1);
  });

  it('ignores cancelled performances and other days', () => {
    const shows = [show([[at(9), at(10)]], DAY, 'cancelled'), show([[at(14), at(15)]], '2026-09-06')];
    const { startMin, slots } = gridTimeBounds(shows, DAY, { date: '2026-09-04', minutes: at(12) });
    expect(startMin).toBe(1080); // the no-performances fallback
    expect(slots).toEqual([1080]);
  });

  // Every block the grid renders has to sit inside its own track. A negative
  // offset put it off the left edge, still focusable, so keyboard users
  // tabbed through picks they could not see.
  it('positions every surviving block at a non-negative offset', () => {
    const shows = [show([[at(14), at(15, 30)], [at(19, 30), at(21)], [at(22), at(23)]])];
    const now = { date: DAY, minutes: at(20) };
    const { startMin } = gridTimeBounds(shows, DAY, now);

    for (const p of shows[0].perfs) {
      if (isPastPerf(p, now)) continue;
      expect(blockLeft(p.start, startMin)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('isPastPerf', () => {
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

describe('blockLeft', () => {
  it('places a block proportionally within the slot it starts in', () => {
    expect(blockLeft(at(20), at(20))).toBe(4);
    expect(blockLeft(at(20, 30), at(20))).toBe(SLOT_WIDTH + 4);
    expect(blockLeft(at(20, 15), at(20))).toBe(SLOT_WIDTH / 2 + 4);
  });
});
