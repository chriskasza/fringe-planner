import { timeBucket } from './dates';
import type { ClashMode, DayKey, Perf, Show, TimeBucket, TimeId } from './types';

type PerfLike = { day: DayKey; start: number; mins: number };

// Two performances overlap if they're the same day and their time ranges intersect.
export function hits(a: PerfLike, b: PerfLike): boolean {
  return a.day === b.day && a.start < b.start + b.mins && b.start < a.start + a.mins;
}

export type PickedEntry = {
  timeId: TimeId;
  show: Show;
  perf: Perf;
};

// timeId -> the show and performance it names, across every status - clash
// detection and the detail panel need to resolve a previously-picked timeId
// even if that performance has since been cancelled.
export function perfIndex(shows: Show[]): Map<TimeId, { show: Show; perf: Perf }> {
  const map = new Map<TimeId, { show: Show; perf: Perf }>();
  for (const show of shows) {
    for (const perf of show.perfs) map.set(perf.timeId, { show, perf });
  }
  return map;
}

export function pickedList(picked: Set<TimeId>, shows: Show[]): PickedEntry[] {
  const index = perfIndex(shows);
  const entries: PickedEntry[] = [];

  for (const timeId of picked) {
    const hit = index.get(timeId);
    if (hit) entries.push({ timeId, show: hit.show, perf: hit.perf });
  }

  return entries.sort((a, b) => a.perf.day.localeCompare(b.perf.day) || a.perf.start - b.perf.start);
}

// True if some *other* picked performance overlaps this one (drives the coral
// edge on things already in the schedule).
export function overlapping(timeId: TimeId, picked: Set<TimeId>, shows: Show[]): boolean {
  const index = perfIndex(shows);
  const self = index.get(timeId);
  if (!self) return false;

  for (const other of picked) {
    if (other === timeId) continue;
    const o = index.get(other);
    if (o && hits(self.perf, o.perf)) return true;
  }
  return false;
}

// True if picking this performance would clash with something already picked
// for a *different* show (drives the coral outline on unpicked things).
export function wouldClash(
  perf: PerfLike & { showId: string },
  picked: Set<TimeId>,
  shows: Show[],
): boolean {
  const index = perfIndex(shows);
  for (const timeId of picked) {
    const hit = index.get(timeId);
    if (!hit || hit.show.id === perf.showId) continue;
    if (hits(perf, hit.perf)) return true;
  }
  return false;
}

export type PerfState = 'picked' | 'picked-clash' | 'clash' | 'free';

export function perfState(show: Show, perf: Perf, picked: Set<TimeId>, shows: Show[]): PerfState {
  if (picked.has(perf.timeId)) {
    return overlapping(perf.timeId, picked, shows) ? 'picked-clash' : 'picked';
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
  daysOn: Record<DayKey, boolean>;
  timeBucketsOn: Record<TimeBucket, boolean>;
  venuesOn: Record<string, boolean>;
  ratingsOn: Record<string, boolean>;
  warningsOn: Record<string, boolean>;
  clash: ClashMode;
  picked: Set<TimeId>;
};

// A show is visible when it isn't excluded, it still has at least one
// performance inside the day/time filter, its venue/rating are switched on,
// none of its content warnings have been switched off, and clash mode allows
// it. Clash mode tests whether *any* of the show's performances is in a
// clash state.
export function visible(show: Show, state: VisibilityState, shows: Show[]): boolean {
  if (state.excluded[show.id]) return false;
  if (state.venuesOn[show.venue] === false) return false;
  if (state.ratingsOn[show.rating] === false) return false;
  // Unlike venue/rating (one value per show), warningTags is a list - a show
  // carrying any switched-off tag drops out. Shows with no warnings are
  // never affected by this filter. Filters on the condensed category tags,
  // not the raw `warnings` text - see ShowMetaEntry.
  if (show.warningTags.some((w) => state.warningsOn[w] === false)) return false;

  // Day/Time gate what you're *browsing*: a show with nothing playing in the
  // selected days and times has nothing to offer, so it drops out entirely
  // (and deselecting every day shows nothing, rather than everything). This
  // never touches `picked` - picks outside the filter stay in the schedule,
  // dimmed in the My Fringe rail.
  const hasPerfInFilter = show.perfs.some(
    (p) => p.status === 'active' && perfInFilter(p, state.daysOn, state.timeBucketsOn),
  );
  if (!hasPerfInFilter) return false;

  if (state.clash === 'show') return true;

  const hasClash = show.perfs.some((p) => {
    const s = perfState(show, p, state.picked, shows);
    return s === 'clash' || s === 'picked-clash';
  });

  return !hasClash;
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

// Earliest active perf that hasn't ended yet, for the Cards view "soonest"
// sort. perfs is already day+start sorted (transform.ts), so .find() is
// enough - no re-sort needed.
export function nextActivePerf(show: Show, now: { date: DayKey; minutes: number }): Perf | undefined {
  return show.perfs.find(
    (p) => p.status === 'active' && (p.day > now.date || (p.day === now.date && p.end > now.minutes)),
  );
}

// A show already in progress (start < now <= end) still counts as upcoming,
// so it sorts near the top
// instead of falling out of order. A show with nothing left to come sorts
// after every show that does, tie-broken alphabetically like both do.
export function compareShowsBySoonest(a: Show, b: Show, now: { date: DayKey; minutes: number }): number {
  const pa = nextActivePerf(a, now);
  const pb = nextActivePerf(b, now);
  if (pa && pb) return pa.day.localeCompare(pb.day) || pa.start - pb.start || a.title.localeCompare(b.title);
  if (pa) return -1;
  if (pb) return 1;
  return a.title.localeCompare(b.title);
}
