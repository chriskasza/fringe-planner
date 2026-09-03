import { describe, expect, it } from 'vitest';
import { blockLeft, gridTimeBounds, scrollAnchorLeft, SLOT_WIDTH } from './gridLayout';
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
    freeAdmission: false,
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
    const { startMin, endMin, slots } = gridTimeBounds(shows, DAY);
    expect(startMin).toBe(at(14));
    expect(endMin).toBe(at(21));
    expect(slots[0]).toBe(at(14));
    expect(slots[slots.length - 1]).toBe(at(20, 30));
  });

  it('shows a past day in full, so the user can look back', () => {
    const shows = [show([[at(14), at(15, 30)]])];
    const { startMin, slots } = gridTimeBounds(shows, DAY);
    expect(startMin).toBe(at(14));
    expect(slots.length).toBeGreaterThan(0);
  });

  // The axis used to be clipped to "from now on" on the current day, which is
  // how finished performances left the board. They stay on it now, hatched,
  // so the axis has to reach back far enough to hold them - orientation is
  // scrollAnchorLeft's job instead.
  it('keeps finished performances on today\'s axis instead of clipping them away', () => {
    const shows = [
      show([
        [at(14), at(15, 30)], // over by 20:00
        [at(19, 30), at(21)],
        [at(22), at(23)],
      ]),
    ];
    const { startMin, endMin } = gridTimeBounds(shows, DAY);
    expect(startMin).toBe(at(14));
    expect(endMin).toBe(at(23));
  });

  it('never produces an axis that starts after it ends', () => {
    const shows = [show([[at(14), at(22, 30)]])];
    const { startMin, endMin, slots } = gridTimeBounds(shows, DAY);
    expect(endMin).toBeGreaterThan(startMin);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toBe(startMin);
  });

  it('falls back to harmless bounds on a day with no performances at all', () => {
    const shows = [show([[at(14), at(15)]], '2026-09-06')];
    const { startMin, endMin, slots } = gridTimeBounds(shows, DAY);
    expect(endMin).toBeGreaterThan(startMin);
    expect(slots.length).toBe(1);
  });

  it('ignores cancelled performances and other days', () => {
    const shows = [show([[at(9), at(10)]], DAY, 'cancelled'), show([[at(14), at(15)]], '2026-09-06')];
    const { startMin, slots } = gridTimeBounds(shows, DAY);
    expect(startMin).toBe(1080); // the no-performances fallback
    expect(slots).toEqual([1080]);
  });

  // Every block the grid renders has to sit inside its own track. A negative
  // offset put it off the left edge, still focusable, so keyboard users
  // tabbed through picks they could not see. Now that played blocks stay on
  // the board this covers *every* performance on the day, not just the
  // survivors of a clip.
  it('positions every block on the day at a non-negative offset', () => {
    const shows = [show([[at(14), at(15, 30)], [at(19, 30), at(21)], [at(22), at(23)]])];
    const { startMin } = gridTimeBounds(shows, DAY);

    for (const p of shows[0].perfs) {
      expect(blockLeft(p.start, startMin)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('scrollAnchorLeft', () => {
  const perfsOf = (s: Show) => s.perfs;

  it('is 0 on a day entirely ahead of us - its own start already is what is next', () => {
    const s = show([[at(14), at(15)], [at(19), at(20)]]);
    const { startMin } = gridTimeBounds([s], DAY);
    expect(scrollAnchorLeft(perfsOf(s), DAY, { date: '2026-09-04', minutes: at(20) }, startMin)).toBe(0);
  });

  it('anchors on the first performance still to come, skipping the played ones', () => {
    const s = show([[at(14), at(15)], [at(19), at(20)], [at(22), at(23)]]);
    const { startMin } = gridTimeBounds([s], DAY); // 14:00
    // 17:00: the 14:00 is over, the 19:00 is next -> 10 half-hour slots along.
    const left = scrollAnchorLeft(perfsOf(s), DAY, { date: DAY, minutes: at(17) }, startMin);
    expect(left).toBe(blockLeft(at(19), startMin) - 4);
  });

  it('keeps a performance that is still running as the anchor', () => {
    const s = show([[at(14), at(15)], [at(19), at(20)]]);
    const { startMin } = gridTimeBounds([s], DAY);
    const left = scrollAnchorLeft(perfsOf(s), DAY, { date: DAY, minutes: at(19, 30) }, startMin);
    expect(left).toBe(blockLeft(at(19), startMin) - 4);
  });

  it('anchors on the last performance once the whole day has been played', () => {
    const s = show([[at(14), at(15)], [at(19), at(20)]]);
    const { startMin } = gridTimeBounds([s], DAY);
    const left = scrollAnchorLeft(perfsOf(s), DAY, { date: DAY, minutes: at(23) }, startMin);
    expect(left).toBe(blockLeft(at(19), startMin) - 4);
  });

  // The scraper's own signal, which arrives a run later than the clock's.
  it('treats a status "ended" performance as played even on a future day', () => {
    const s = show([[at(14), at(15)], [at(19), at(20)]], DAY, 'ended');
    const { startMin } = gridTimeBounds([s], DAY);
    const left = scrollAnchorLeft(perfsOf(s), DAY, { date: '2026-09-04', minutes: at(9) }, startMin);
    expect(left).toBe(blockLeft(at(19), startMin) - 4);
  });

  it('is never negative, and is 0 for a day with nothing on it', () => {
    const s = show([[at(14), at(15)]]);
    expect(scrollAnchorLeft(perfsOf(s), '2026-09-06', { date: DAY, minutes: at(20) }, at(14))).toBe(0);
  });
});

describe('blockLeft', () => {
  it('places a block proportionally within the slot it starts in', () => {
    expect(blockLeft(at(20), at(20))).toBe(4);
    expect(blockLeft(at(20, 30), at(20))).toBe(SLOT_WIDTH + 4);
    expect(blockLeft(at(20, 15), at(20))).toBe(SLOT_WIDTH / 2 + 4);
  });
});
