import { useEffect, useRef } from 'react';
import type { AppState } from './state';
import type { ClashMode, DayKey, Show, SortMode, TimeBucket } from './types';

const STORAGE_KEY = 'fringe-filters';
const DEBOUNCE_MS = 250;

// Sort isn't a filter - it doesn't narrow what's browsable, and Reset All
// deliberately leaves it alone (see state.ts) - but it's the same kind of
// personal, non-shareable display preference as clash/query, so it rides
// along on the same localStorage blob rather than getting a second one.
export type FilterState = Pick<
  AppState,
  'daysOn' | 'timeBucketsOn' | 'venuesOn' | 'ratingsOn' | 'warningsOn' | 'excluded' | 'clash' | 'query' | 'sort'
>;

// daysOn/timeBucketsOn/venuesOn/ratingsOn/warningsOn are opt-out (default
// on), so only their off-keys are worth recording - a blank slate needs no
// entry at all. excluded is opt-in (default not-excluded), so it's the
// mirror image: only the on (excluded) ids are recorded.
type PersistedFilters = {
  v?: 1;
  daysOff?: DayKey[];
  timeBucketsOff?: TimeBucket[];
  venuesOff?: string[];
  ratingsOff?: string[];
  warningsOff?: string[];
  excluded?: string[]; // showIds
  clash?: ClashMode;
  query?: string;
  sort?: SortMode;
};

function offKeys(map: Record<string, boolean>): string[] {
  return Object.keys(map)
    .filter((k) => !map[k])
    .sort();
}

export function encodeFilters(filters: FilterState): string {
  const persisted: PersistedFilters = {
    v: 1,
    daysOff: offKeys(filters.daysOn),
    timeBucketsOff: offKeys(filters.timeBucketsOn) as TimeBucket[],
    venuesOff: offKeys(filters.venuesOn),
    ratingsOff: offKeys(filters.ratingsOn),
    warningsOff: offKeys(filters.warningsOn),
    excluded: Object.keys(filters.excluded)
      .filter((id) => filters.excluded[id])
      .sort(),
    clash: filters.clash,
    query: filters.query,
    sort: filters.sort,
  };
  return JSON.stringify(persisted);
}

function safeParse(text: string): PersistedFilters | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as PersistedFilters) : null;
  } catch {
    return null;
  }
}

function asStringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];
}

// Only keys that exist in `map` (the freshly computed default for the
// current festival data) are ever produced - a saved key no longer present
// (a stale venue/rating/warning/day) is dropped simply by not being
// iterated. A current key with no saved off-entry keeps `map`'s own default
// rather than being forced to `true` - this is what lets daysOn's
// date-dependent default (past days start off) apply to a day that wasn't
// in the saved blob at all, and what lets a brand-new venue/rating/warning
// from a re-scrape default to visible instead of hidden.
function mergeMap(map: Record<string, boolean>, offList: unknown): Record<string, boolean> {
  const off = new Set(asStringArray(offList));
  const result: Record<string, boolean> = {};
  for (const key of Object.keys(map)) {
    result[key] = off.has(key) ? false : map[key];
  }
  return result;
}

// `fresh` is the just-computed createInitialState() result, not re-derived
// from `shows`/`days` independently - see mergeMap's comment for why that
// matters. A saved blob that's missing, empty, malformed JSON, or not an
// object falls back to `fresh` entirely; a validly-shaped blob with one bad
// field (wrong type, unknown clash value) falls back only for that field, so
// one corrupt entry can't take down the rest of a restore.
export function decodeFilters(saved: string, fresh: FilterState, shows: Show[]): FilterState {
  const parsed = safeParse(saved);
  if (!parsed) return fresh;

  const validShowIds = new Set(shows.map((s) => s.id));
  const excluded: Record<string, boolean> = {};
  for (const id of asStringArray(parsed.excluded)) {
    if (validShowIds.has(id)) excluded[id] = true;
  }

  return {
    daysOn: mergeMap(fresh.daysOn, parsed.daysOff),
    timeBucketsOn: mergeMap(fresh.timeBucketsOn, parsed.timeBucketsOff),
    venuesOn: mergeMap(fresh.venuesOn, parsed.venuesOff),
    ratingsOn: mergeMap(fresh.ratingsOn, parsed.ratingsOff),
    warningsOn: mergeMap(fresh.warningsOn, parsed.warningsOff),
    excluded,
    clash: parsed.clash === 'show' || parsed.clash === 'hide' ? parsed.clash : fresh.clash,
    query: typeof parsed.query === 'string' ? parsed.query : fresh.query,
    sort:
      parsed.sort === 'random' || parsed.sort === 'title' || parsed.sort === 'soonest' ? parsed.sort : fresh.sort,
  };
}

export function loadInitialFilters(fresh: FilterState, shows: Show[]): FilterState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return decodeFilters(stored, fresh, shows);
  } catch {
    // localStorage unavailable (private browsing, etc.) - fall through to fresh
  }
  return fresh;
}

// Deliberately simpler than persistence.ts's usePersistence: filters are
// localStorage-only, so there's no URL hash, no history.replaceState, and no
// popstate listener to keep in sync - just a debounced write. Depends on the
// individual filter fields rather than a whole AppState object, whose
// identity changes on every dispatch (including unrelated ones like
// SET_GRID_DAY or TOGGLE_EXPANDED) - depending on the object would restart
// the debounce on every state change, not just a filter change.
export function useFilterPersistence(filters: FilterState): void {
  const { daysOn, timeBucketsOn, venuesOn, ratingsOn, warningsOn, excluded, clash, query, sort } = filters;
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          encodeFilters({ daysOn, timeBucketsOn, venuesOn, ratingsOn, warningsOn, excluded, clash, query, sort }),
        );
      } catch {
        // ignore storage failures
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
  }, [daysOn, timeBucketsOn, venuesOn, ratingsOn, warningsOn, excluded, clash, query, sort]);
}
