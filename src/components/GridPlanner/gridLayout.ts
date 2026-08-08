import type { DayKey, Show } from '../../lib/types';

// Fixed per-slot width rather than `1fr` - the real data can span a full day
// (10:30am-10:30pm) on some dates, which is many half-hour columns, and
// letting those share available width would squeeze every title unreadably
// thin. A fixed width plus horizontal scroll (see GridPlanner.css) keeps
// each column readable.
export const SLOT_WIDTH = 140;

// Below 700px, 140px puts less than two half-hour slots on a 375px screen -
// less than a single performance, so two concurrent shows in different
// venues can never be seen at once, which is the whole reason this grid (as
// opposed to a flat list) exists. 88px fits ~4 slots (a 1h45m window) in the
// same space and still leaves a 30-min block (blockWidth(30) = 80px) readable.
export const SLOT_WIDTH_NARROW = 88;

// Threaded through explicitly (see blockLeft/blockWidth/trackWidth below)
// rather than read from this module at import time, so callers can vary it
// per viewport without a second copy of the number living in CSS too.
export function slotWidth(isNarrow: boolean): number {
  return isNarrow ? SLOT_WIDTH_NARROW : SLOT_WIDTH;
}

// On the current day a performance that has already finished isn't useful
// browsing real estate, so it drops off the grid. "Finished", not "started":
// a show that's running right now keeps its block until it ends.
//
// This is the single rule the axis and the blocks both go through. Clipping
// only the axis (as this used to) left the blocks in place: a 14:00
// performance viewed at 20:00 was positioned 1676px to the left of the track
// - invisible, but still focusable, so keyboard users tabbed through picks
// they couldn't see - and late enough in the evening the axis start ran past
// the axis end and the day rendered as venue rows with no time slots and
// nothing in them, with no empty-state message either.
export function isPastPerf(perf: { day: DayKey; end: number }, now: { date: DayKey; minutes: number }): boolean {
  return perf.day === now.date && perf.end <= now.minutes;
}

// Bounds are computed per day, not once across the whole festival. Days
// entirely in the past still show their full range - the user can look back.
export function gridTimeBounds(
  shows: Show[],
  day: DayKey,
  now: { date: DayKey; minutes: number },
): { startMin: number; endMin: number; slots: number[] } {
  let min = Infinity;
  let max = -Infinity;

  for (const show of shows) {
    for (const p of show.perfs) {
      if (p.status !== 'active' || p.day !== day) continue;
      if (isPastPerf(p, now)) continue;
      if (p.start < min) min = p.start;
      if (p.end > max) max = p.end;
    }
  }

  // Nothing left to show today, or a day with no performances at all. The
  // caller filters by the same rule and renders its empty state; these bounds
  // just have to be harmless.
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { startMin: 1080, endMin: 1230, slots: [1080] };
  }

  const startMin = Math.floor(min / 30) * 30;
  const endMin = Math.ceil(max / 30) * 30;

  const slots: number[] = [];
  for (let t = startMin; t < endMin; t += 30) slots.push(t);

  return { startMin, endMin, slots };
}

// Blocks are positioned as continuous pixel offsets within .venue-row__track
// (position:relative), not CSS grid columns - most real showtimes fall on
// the half-hour, but a handful start at :15/:40/:45. A fractional grid line
// number (e.g. 18.5) is invalid, so the browser silently drops that
// placement and auto-places the block into the first cell instead. Pixel
// math handles any start time exactly, proportionally between labels.
const BLOCK_GAP_X = 4;
const BLOCK_INSET_Y = 8;

export function blockLeft(start: number, gridStartMin: number, slotWidthPx: number = SLOT_WIDTH): number {
  return ((start - gridStartMin) / 30) * slotWidthPx + BLOCK_GAP_X;
}

// Width is exactly proportional to duration, with no artificial minimum -
// the whole point of a time grid is judging duration and overlap by eye, and
// padding every short show out to a fake minimum width (as this used to do)
// makes a 30-minute show look identical to a 60-minute one, which reads as a
// false overlap with whatever starts when the short show actually ends. The
// shortest real performance is 30 min, which is still comfortably wide (132px
// at the current SLOT_WIDTH), so there's no readability need for a floor.
export function blockWidth(mins: number, slotWidthPx: number = SLOT_WIDTH): number {
  return (mins / 30) * slotWidthPx - BLOCK_GAP_X * 2;
}

export const BLOCK_INSET_Y_PX = BLOCK_INSET_Y;

// The label column is a fixed 150px; the track needs its own explicit total
// width (not `1fr`/`auto`) so the row's own box - and its border - actually
// spans the full scrollable content instead of staying capped at whatever
// width was available in the (unscrolled) viewport.
export function trackWidth(slotCount: number, slotWidthPx: number = SLOT_WIDTH): number {
  return slotCount * slotWidthPx;
}
