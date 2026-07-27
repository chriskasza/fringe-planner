import { nowInHalifax, TIME_BUCKETS } from './dates';
import { perfInFilter, perfKey } from './derived';
import type { ClashMode, Day, DayKey, DetailTarget, MenuKey, PerfKey, Show, TimeBucket, ViewMode } from './types';

// Derived from TIME_BUCKETS rather than spelled out, so adding or renaming a
// bucket doesn't need matching edits in the initial state and the reset.
function allTimeBucketsOn(): Record<TimeBucket, boolean> {
  return Object.fromEntries(TIME_BUCKETS.map((b) => [b.key, true])) as Record<TimeBucket, boolean>;
}

export type AppState = {
  picked: Set<PerfKey>;
  daysOn: Record<DayKey, boolean>;
  timeBucketsOn: Record<TimeBucket, boolean>;
  venuesOn: Record<string, boolean>;
  ratingsOn: Record<string, boolean>;
  excluded: Record<string, boolean>; // showId -> excluded
  clash: ClashMode;
  query: string;
  viewMode: ViewMode;
  gridDay: DayKey;
  openMenu: { grid: MenuKey; cards: MenuKey };
  expanded: Record<string, boolean>; // showId -> time list expanded
  detail: DetailTarget | null;
  syncOpen: boolean;
};

export function createInitialState(
  days: Day[],
  shows: Show[],
  now: { date: DayKey; minutes: number } = nowInHalifax(),
): AppState {
  const daysOn: Record<DayKey, boolean> = {};
  for (const d of days) {
    // Days before today (Halifax wall clock) are deselected on load so the
    // user starts browsing the festival from today forward. They can
    // re-enable past days in the Day filter to look back at what was on.
    daysOn[d.key] = d.key >= now.date;
  }

  const timeBucketsOn = allTimeBucketsOn();

  const venuesOn: Record<string, boolean> = {};
  for (const v of new Set(shows.map((s) => s.venue))) venuesOn[v] = true;

  const ratingsOn: Record<string, boolean> = {};
  for (const r of new Set(shows.map((s) => s.rating))) ratingsOn[r] = true;

  // The landing day has to agree with `daysOn` above: opening on the first
  // day of the festival while that day is filtered out puts the user on a
  // grid whose own day is switched off. Prefer the first day from today
  // forward that has shows; once the festival is over there's no such day, so
  // fall back to the last day that had any (and switch it back on, since
  // every day is in the past by then).
  const gridDay =
    days.find((d) => d.count > 0 && d.key >= now.date) ??
    [...days].reverse().find((d) => d.count > 0) ??
    days[0];
  daysOn[gridDay.key] = true;

  return {
    picked: new Set(),
    daysOn,
    timeBucketsOn,
    venuesOn,
    ratingsOn,
    excluded: {},
    clash: 'all',
    query: '',
    // TODO: default to 'cards' (matching the design's intended first
    // screen) once Card Browser is fully built - 'grid' for now since it's
    // the only complete view.
    viewMode: 'grid',
    gridDay: gridDay.key,
    openMenu: { grid: null, cards: null },
    expanded: {},
    detail: null,
    syncOpen: false,
  };
}

export type AppAction =
  | { type: 'TOGGLE_PICK'; key: PerfKey }
  | { type: 'SET_PICKED'; picked: Set<PerfKey> }
  | { type: 'TOGGLE_SHOW_STAR'; show: Show }
  | { type: 'SET_DAY_ON'; day: DayKey; on: boolean }
  | { type: 'SET_ALL_DAYS'; days: DayKey[]; on: boolean }
  | { type: 'SET_TIME_BUCKET_ON'; bucket: TimeBucket; on: boolean }
  | { type: 'SET_ALL_TIME_BUCKETS'; on: boolean }
  | { type: 'SET_VENUE_ON'; venue: string; on: boolean }
  | { type: 'SET_ALL_VENUES'; venues: string[]; on: boolean }
  | { type: 'SET_RATING_ON'; rating: string; on: boolean }
  | { type: 'SET_ALL_RATINGS'; ratings: string[]; on: boolean }
  | { type: 'SET_EXCLUDED'; showId: string; excluded: boolean }
  | { type: 'SET_ALL_EXCLUDED'; showIds: string[]; excluded: boolean }
  | { type: 'SET_CLASH'; mode: ClashMode }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_VIEW'; view: ViewMode }
  | { type: 'SET_GRID_DAY'; day: DayKey }
  | { type: 'SET_OPEN_MENU'; view: 'grid' | 'cards'; menu: MenuKey }
  | { type: 'CLOSE_MENUS' }
  | { type: 'TOGGLE_EXPANDED'; showId: string }
  | { type: 'SET_DETAIL'; detail: DetailTarget | null }
  | { type: 'SET_SYNC_OPEN'; open: boolean }
  | { type: 'RESET_ALL_FILTERS'; days: DayKey[]; venues: string[]; ratings: string[] };

function toggleSet(set: Set<PerfKey>, key: PerfKey): Set<PerfKey> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'TOGGLE_PICK':
      return { ...state, picked: toggleSet(state.picked, action.key) };

    case 'SET_PICKED':
      return { ...state, picked: action.picked };

    case 'TOGGLE_SHOW_STAR': {
      const { show } = action;
      const allKeys = show.perfs
        .filter((p) => p.status === 'active')
        .map((p) => perfKey(show.id, p.day, p.start));
      const anyPicked = allKeys.some((k) => state.picked.has(k));

      const picked = new Set(state.picked);
      if (anyPicked) {
        for (const k of allKeys) picked.delete(k);
      } else {
        // "In filter" has to mean the same thing here as it does everywhere
        // else (perfInFilter: day *and* time-of-day bucket). Gating on daysOn
        // alone let the star add performances the card, the time pills and
        // the rail all treat as filtered out, so they landed in the schedule
        // dimmed and unexplained.
        const inFilterKeys = show.perfs
          .filter(
            (p) => p.status === 'active' && perfInFilter(p, state.daysOn, state.timeBucketsOn),
          )
          .map((p) => perfKey(show.id, p.day, p.start));
        for (const k of inFilterKeys) picked.add(k);
      }
      return { ...state, picked };
    }

    case 'SET_DAY_ON':
      return { ...state, daysOn: { ...state.daysOn, [action.day]: action.on } };

    case 'SET_ALL_DAYS': {
      const daysOn = { ...state.daysOn };
      for (const d of action.days) daysOn[d] = action.on;
      return { ...state, daysOn };
    }

    case 'SET_TIME_BUCKET_ON':
      return { ...state, timeBucketsOn: { ...state.timeBucketsOn, [action.bucket]: action.on } };

    case 'SET_ALL_TIME_BUCKETS': {
      const timeBucketsOn = { ...state.timeBucketsOn };
      for (const b of TIME_BUCKETS) timeBucketsOn[b.key] = action.on;
      return { ...state, timeBucketsOn };
    }

    case 'SET_VENUE_ON':
      return { ...state, venuesOn: { ...state.venuesOn, [action.venue]: action.on } };

    case 'SET_ALL_VENUES': {
      const venuesOn = { ...state.venuesOn };
      for (const v of action.venues) venuesOn[v] = action.on;
      return { ...state, venuesOn };
    }

    case 'SET_RATING_ON':
      return { ...state, ratingsOn: { ...state.ratingsOn, [action.rating]: action.on } };

    case 'SET_ALL_RATINGS': {
      const ratingsOn = { ...state.ratingsOn };
      for (const r of action.ratings) ratingsOn[r] = action.on;
      return { ...state, ratingsOn };
    }

    case 'SET_EXCLUDED':
      return { ...state, excluded: { ...state.excluded, [action.showId]: action.excluded } };

    case 'SET_ALL_EXCLUDED': {
      const excluded = { ...state.excluded };
      for (const id of action.showIds) excluded[id] = action.excluded;
      return { ...state, excluded };
    }

    case 'SET_CLASH':
      return { ...state, clash: action.mode };

    case 'SET_QUERY':
      return { ...state, query: action.query };

    case 'SET_VIEW':
      return { ...state, viewMode: action.view };

    // Additive, not exclusive: switching the grid to a day makes sure that
    // day is switched on (so the grid can never render blank because its own
    // day is filtered out), but leaves the other days alone. Narrowing
    // daysOn to just this day - as the handoff's "date filter narrows to it"
    // literally reads - silently destroys a multi-day filter the moment you
    // click through days in the grid, and that only became visible once the
    // date filter actually gated which shows are browsable.
    case 'SET_GRID_DAY':
      return { ...state, gridDay: action.day, daysOn: { ...state.daysOn, [action.day]: true } };

    case 'SET_OPEN_MENU':
      return { ...state, openMenu: { ...state.openMenu, [action.view]: action.menu } };

    case 'CLOSE_MENUS':
      return { ...state, openMenu: { grid: null, cards: null } };

    case 'TOGGLE_EXPANDED':
      return {
        ...state,
        expanded: { ...state.expanded, [action.showId]: !state.expanded[action.showId] },
      };

    case 'SET_DETAIL':
      return { ...state, detail: action.detail };

    case 'SET_SYNC_OPEN':
      return { ...state, syncOpen: action.open };

    case 'RESET_ALL_FILTERS': {
      const daysOn: Record<DayKey, boolean> = {};
      for (const d of action.days) daysOn[d] = true;
      const venuesOn: Record<string, boolean> = {};
      for (const v of action.venues) venuesOn[v] = true;
      const ratingsOn: Record<string, boolean> = {};
      for (const r of action.ratings) ratingsOn[r] = true;
      const timeBucketsOn = allTimeBucketsOn();
      return {
        ...state,
        daysOn,
        venuesOn,
        ratingsOn,
        timeBucketsOn,
        excluded: {},
        clash: 'all',
        query: '',
      };
    }

    default:
      return state;
  }
}
