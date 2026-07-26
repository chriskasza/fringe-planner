import type { Show } from '../../lib/types';

// The design mocks a fixed 6:00 PM-10:30 PM evening grid, but the real festival
// runs matinees from mid-morning. Deriving the bounds from actual performance
// times (instead of hardcoding the mock's window) means daytime shows are
// still visible instead of silently clipped off the grid.
export function gridTimeBounds(shows: Show[]): { startMin: number; endMin: number; slots: number[] } {
  let min = Infinity;
  let max = -Infinity;

  for (const show of shows) {
    for (const p of show.perfs) {
      if (p.status !== 'active') continue;
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

export function columnFor(start: number, gridStartMin: number): number {
  return 2 + (start - gridStartMin) / 30;
}

export function spanFor(mins: number): number {
  return Math.max(2, Math.round(mins / 30));
}
