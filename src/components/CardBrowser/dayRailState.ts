import { perfInFilter, perfState } from '../../lib/derived';
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
): { cellState: DayRailCellState; count: number } {
  const perfs = show.perfs.filter((p) => p.status === 'active' && p.day === day);
  if (perfs.length === 0) return { cellState: 'none', count: 0 };

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

  return { cellState, count: perfs.length };
}
