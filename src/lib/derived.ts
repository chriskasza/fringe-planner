import { timeBucket } from './dates';
import type { ClashMode, DayKey, PerfKey, Show, TimeBucket } from './types';

export function perfKey(showId: string, day: DayKey, start: number): PerfKey {
  return `${showId}|${day}|${start}`;
}

export function parsePerfKey(key: PerfKey): { showId: string; day: DayKey; start: number } {
  const [showId, day, startStr] = key.split('|');
  return { showId, day, start: Number(startStr) };
}

type PerfLike = { day: DayKey; start: number; mins: number };

// Two performances overlap if they're the same day and their time ranges intersect.
export function hits(a: PerfLike, b: PerfLike): boolean {
  return a.day === b.day && a.start < b.start + b.mins && b.start < a.start + a.mins;
}

export type PickedEntry = {
  key: PerfKey;
  show: Show;
  perf: Show['perfs'][number];
};

function showById(shows: Show[]): Map<string, Show> {
  return new Map(shows.map((s) => [s.id, s]));
}

export function pickedList(picked: Set<PerfKey>, shows: Show[]): PickedEntry[] {
  const byId = showById(shows);
  const entries: PickedEntry[] = [];

  for (const key of picked) {
    const { showId, day, start } = parsePerfKey(key);
    const show = byId.get(showId);
    const perf = show?.perfs.find((p) => p.day === day && p.start === start);
    if (show && perf) entries.push({ key, show, perf });
  }

  return entries.sort((a, b) => a.perf.day.localeCompare(b.perf.day) || a.perf.start - b.perf.start);
}

// True if some *other* picked performance overlaps this one (drives the coral
// edge on things already in the schedule).
export function overlapping(key: PerfKey, picked: Set<PerfKey>, shows: Show[]): boolean {
  const { day, start, showId } = parsePerfKey(key);
  const self = { day, start, mins: 0 };
  const byId = showById(shows);
  const show = byId.get(showId);
  const perf = show?.perfs.find((p) => p.day === day && p.start === start);
  if (!perf) return false;
  self.mins = perf.mins;

  for (const other of picked) {
    if (other === key) continue;
    const o = parsePerfKey(other);
    const oShow = byId.get(o.showId);
    const oPerf = oShow?.perfs.find((p) => p.day === o.day && p.start === o.start);
    if (oPerf && hits(self, oPerf)) return true;
  }
  return false;
}

// True if picking this performance would clash with something already picked
// for a *different* show (drives the coral outline on unpicked things).
export function wouldClash(
  perf: PerfLike & { showId: string },
  picked: Set<PerfKey>,
  shows: Show[],
): boolean {
  const byId = showById(shows);
  for (const key of picked) {
    const p = parsePerfKey(key);
    if (p.showId === perf.showId) continue;
    const oShow = byId.get(p.showId);
    const oPerf = oShow?.perfs.find((x) => x.day === p.day && x.start === p.start);
    if (oPerf && hits(perf, oPerf)) return true;
  }
  return false;
}

export type PerfState = 'picked' | 'picked-clash' | 'clash' | 'free';

export function perfState(
  show: Show,
  perf: Show['perfs'][number],
  picked: Set<PerfKey>,
  shows: Show[],
): PerfState {
  const key = perfKey(show.id, perf.day, perf.start);
  if (picked.has(key)) {
    return overlapping(key, picked, shows) ? 'picked-clash' : 'picked';
  }
  return wouldClash({ ...perf, showId: show.id }, picked, shows) ? 'clash' : 'free';
}

// True if the performance's day and time-of-day are both currently switched on
// - the shared notion of "in filter" used by star-picking, rail dimming, and
// the card time-pill list.
export function perfInFilter(
  perf: { day: DayKey; start: number },
  daysOn: Record<DayKey, boolean>,
  timeBucketsOn: Record<TimeBucket, boolean>,
): boolean {
  return Boolean(daysOn[perf.day]) && Boolean(timeBucketsOn[timeBucket(perf.start)]);
}

type VisibilityState = {
  excluded: Record<string, boolean>;
  venuesOn: Record<string, boolean>;
  ratingsOn: Record<string, boolean>;
  clash: ClashMode;
  picked: Set<PerfKey>;
};

// A show is visible when it isn't excluded, its venue/rating are switched on,
// and clash mode allows it. Clash mode tests whether *any* of the show's
// performances is in a clash state.
export function visible(show: Show, state: VisibilityState, shows: Show[]): boolean {
  if (state.excluded[show.id]) return false;
  if (state.venuesOn[show.venue] === false) return false;
  if (state.ratingsOn[show.rating] === false) return false;
  if (state.clash === 'all') return true;

  const hasClash = show.perfs.some((p) => {
    const s = perfState(show, p, state.picked, shows);
    return s === 'clash' || s === 'picked-clash';
  });

  return state.clash === 'only' ? hasClash : !hasClash;
}

export function matchesQuery(show: Show, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    show.title.toLowerCase().includes(q) ||
    show.venue.toLowerCase().includes(q) ||
    show.venueShort.toLowerCase().includes(q)
  );
}

export function clashModeLabel(mode: ClashMode): string {
  return mode.toUpperCase();
}
