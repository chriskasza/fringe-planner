import { isPlayed, notCancelled, perfInFilter, perfState } from '../../lib/derived';
import type { AppState } from '../../lib/state';
import type { DayKey, Show } from '../../lib/types';

export type DayRailCellState = 'none' | 'available' | 'outside-filter' | 'clash' | 'picked' | 'picked-clash';

// Precedence when a day holds several performances: picked-clash > picked >
// outside-filter > clash > available (design rule).
export function dayRailCellState(
  show: Show,
  day: DayKey,
  state: Pick<AppState, 'picked' | 'daysOn' | 'timeBucketsOn'>,
  shows: Show[],
  now: { date: DayKey; minutes: number },
): { cellState: DayRailCellState; count: number; played: boolean } {
  // Played performances still count: the rail is the show's whole run, and a
  // day that has gone by keeps whatever was picked on it.
  const perfs = show.perfs.filter((p) => notCancelled(p) && p.day === day);
  if (perfs.length === 0) return { cellState: 'none', count: 0, played: false };

  let anyPickedClash = false;
  let anyPicked = false;
  let anyOutsideFilter = false;
  let anyClash = false;

  for (const perf of perfs) {
    const s = perfState(show, perf, state.picked, shows);
    if (s === 'picked-clash') anyPickedClash = true;
    else if (s === 'picked') anyPicked = true;
    else if (s === 'clash') anyClash = true;

    if (!perfInFilter(perf, state.daysOn, state.timeBucketsOn)) anyOutsideFilter = true;
  }

  let cellState: DayRailCellState = 'available';
  if (anyPickedClash) cellState = 'picked-clash';
  else if (anyPicked) cellState = 'picked';
  else if (anyOutsideFilter) cellState = 'outside-filter';
  else if (anyClash) cellState = 'clash';

  // Reported separately from cellState, not as a seventh value of it: the
  // hatch layers over whichever state applies, so a picked day that has been
  // played is still `picked` - it just also reads as done. Only *every*
  // performance on the day being played makes the cell played; a day with one
  // show left to come is still a day with something on it.
  return { cellState, count: perfs.length, played: perfs.every((p) => isPlayed(p, now)) };
}
