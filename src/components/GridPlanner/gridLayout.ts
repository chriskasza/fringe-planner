import type { DayKey, Show } from '../../lib/types';

// Fixed per-slot width rather than `1fr` - the real data can span a full day
// (10:30am-10:30pm) on some dates, which is many half-hour columns, and
// letting those share available width would squeeze every title unreadably
// thin. A fixed width plus horizontal scroll (see GridPlanner.css) keeps
// each column readable.
export const SLOT_WIDTH = 140;

// The sticky venue-label column's width, with the 26px leading gutter folded
// directly in (150px label + 26px inset). The gutter can't just be padding
// on the scroll container: padding doesn't clip content, so a scrolled block
// would still visually render into that space, uncovered, since the sticky
// label itself only starts at the padding edge. Making the label's own box
// (and its sticky background) span the full 176px - with the venue name
// text inset by its own internal padding - means there's no gap left for
// anything to show through.
export const LABEL_WIDTH = 176;

// Bounds are computed per day, not once across the whole festival - most
// nights start well after 10:30am and end well before 10:30pm, and showing
// that full range every day would waste most of the grid on empty columns
// before the first show and after the last. A day with a late cabaret
// running past midnight still gets those hours shown; a day that's all
// matinees doesn't drag the axis out to 10:30pm for no reason.
export function gridTimeBounds(
  shows: Show[],
  day: DayKey,
): { startMin: number; endMin: number; slots: number[] } {
  let min = Infinity;
  let max = -Infinity;

  for (const show of shows) {
    for (const p of show.perfs) {
      if (p.status !== 'active' || p.day !== day) continue;
      if (p.start < min) min = p.start;
      if (p.end > max) max = p.end;
    }
  }

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

export function blockLeft(start: number, gridStartMin: number): number {
  return ((start - gridStartMin) / 30) * SLOT_WIDTH + BLOCK_GAP_X;
}

// Width is exactly proportional to duration, with no artificial minimum -
// the whole point of a time grid is judging duration and overlap by eye, and
// padding every short show out to a fake minimum width (as this used to do)
// makes a 30-minute show look identical to a 60-minute one, which reads as a
// false overlap with whatever starts when the short show actually ends. The
// shortest real performance is 30 min, which is still comfortably wide (132px
// at the current SLOT_WIDTH), so there's no readability need for a floor.
export function blockWidth(mins: number): number {
  return (mins / 30) * SLOT_WIDTH - BLOCK_GAP_X * 2;
}

export const BLOCK_INSET_Y_PX = BLOCK_INSET_Y;

// The label column is a fixed 150px; the track needs its own explicit total
// width (not `1fr`/`auto`) so the row's own box - and its border - actually
// spans the full scrollable content instead of staying capped at whatever
// width was available in the (unscrolled) viewport.
export function trackWidth(slotCount: number): number {
  return slotCount * SLOT_WIDTH;
}
