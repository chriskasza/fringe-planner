import { nowInHalifax, TIME_BUCKETS } from './dates';
import type { ClashMode, Day, DayKey, DetailTarget, MenuKey, Show, SortMode, TimeBucket, TimeId, ViewMode } from './types';

// Derived from TIME_BUCKETS rather than spelled out, so adding or renaming a
// bucket doesn't need matching edits in the initial state and the reset.
function allTimeBucketsOn(): Record<TimeBucket, boolean> {
  return Object.fromEntries(TIME_BUCKETS.map((b) => [b.key, true])) as Record<TimeBucket, boolean>;
}

export type AppState = {
  picked: Set<TimeId>;
  daysOn: Record<DayKey, boolean>;
  timeBucketsOn: Record<TimeBucket, boolean>;
  venuesOn: Record<string, boolean>;
  ratingsOn: Record<string, boolean>;
  warningsOn: Record<string, boolean>;
  excluded: Record<string, boolean>; // showId -> excluded
  clash: ClashMode;
  query: string;
  viewMode: ViewMode;
  sort: SortMode;
  gridDay: DayKey;
  openMenu: { grid: MenuKey; cards: MenuKey };
  expanded: Record<string, boolean>; // showId -> time list expanded
  detail: DetailTarget | null;
  syncOpen: boolean;
  myFringeOpen: boolean;
  // Incremented on every pick that *adds* a performance - TopBar keys its
  // picked-count badge on this to replay a "pop" animation each time,
  // without forcing the panel open.
  pickPulse: number;
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

  const warningsOn: Record<string, boolean> = {};
  for (const w of new Set(shows.flatMap((s) => s.warningTags))) warningsOn[w] = true;

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
    warningsOn,
    excluded: {},
    clash: 'show',
    query: '',
    // TODO: default to 'cards' (matching the design's intended first
    // screen) once Card Browser is fully built - 'grid' for now since it's
    // the only complete view.
    viewMode: 'grid',
    sort: 'random',
    gridDay: gridDay.key,
    openMenu: { grid: null, cards: null },
    expanded: {},
    detail: null,
    syncOpen: false,
    myFringeOpen: false,
    pickPulse: 0,
  };
}

export type AppAction =
  | { type: 'TOGGLE_PICK'; timeId: TimeId }
  | { type: 'SET_PICKED'; picked: Set<TimeId> }
  | { type: 'SET_DAY_ON'; day: DayKey; on: boolean }
  | { type: 'SET_ALL_DAYS'; days: DayKey[]; on: boolean }
  | { type: 'SET_TIME_BUCKET_ON'; bucket: TimeBucket; on: boolean }
  | { type: 'SET_ALL_TIME_BUCKETS'; on: boolean }
  | { type: 'SET_VENUE_ON'; venue: string; on: boolean }
  | { type: 'SET_ALL_VENUES'; venues: string[]; on: boolean }
  | { type: 'SET_RATING_ON'; rating: string; on: boolean }
  | { type: 'SET_ALL_RATINGS'; ratings: string[]; on: boolean }
  | { type: 'SET_WARNING_ON'; warning: string; on: boolean }
  | { type: 'SET_ALL_WARNINGS'; warnings: string[]; on: boolean }
  | { type: 'SET_EXCLUDED'; showId: string; excluded: boolean }
  | { type: 'SET_ALL_EXCLUDED'; showIds: string[]; excluded: boolean }
  | { type: 'SET_CLASH'; mode: ClashMode }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_VIEW'; view: ViewMode }
  | { type: 'SET_SORT'; sort: SortMode }
  | { type: 'SET_GRID_DAY'; day: DayKey }
  | { type: 'SET_OPEN_MENU'; view: 'grid' | 'cards'; menu: MenuKey }
  | { type: 'CLOSE_MENUS' }
  | { type: 'TOGGLE_EXPANDED'; showId: string }
  | { type: 'SET_DETAIL'; detail: DetailTarget | null }
  | { type: 'SET_SYNC_OPEN'; open: boolean }
  | { type: 'SET_MY_FRINGE_OPEN'; open: boolean }
  | { type: 'RESET_ALL_FILTERS'; days: DayKey[]; venues: string[]; ratings: string[]; warnings: string[] };

function toggleSet(set: Set<TimeId>, timeId: TimeId): Set<TimeId> {
  const next = new Set(set);
  if (next.has(timeId)) next.delete(timeId);
  else next.add(timeId);
  return next;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'TOGGLE_PICK': {
      // Only bumps pickPulse when this toggle *adds* a pick - un-picking
      // (including via the panel's own remove button) leaves it untouched,
      // so removing a show doesn't replay the badge-pop cue.
      const adding = !state.picked.has(action.timeId);
      return {
        ...state,
        picked: toggleSet(state.picked, action.timeId),
        pickPulse: adding ? state.pickPulse + 1 : state.pickPulse,
      };
    }

    case 'SET_PICKED':
      return { ...state, picked: action.picked };

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

    case 'SET_WARNING_ON':
      return { ...state, warningsOn: { ...state.warningsOn, [action.warning]: action.on } };

    case 'SET_ALL_WARNINGS': {
      const warningsOn = { ...state.warningsOn };
      for (const w of action.warnings) warningsOn[w] = action.on;
      return { ...state, warningsOn };
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

    case 'SET_SORT':
      return { ...state, sort: action.sort };

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

    // DetailPanel and MyFringePanel are mutually exclusive (same width, same
    // mount point, only one visible at a time) - opening one closes the
    // other, here rather than in every call site that dispatches either.
    case 'SET_DETAIL':
      return { ...state, detail: action.detail, myFringeOpen: action.detail ? false : state.myFringeOpen };

    case 'SET_SYNC_OPEN':
      return { ...state, syncOpen: action.open };

    case 'SET_MY_FRINGE_OPEN':
      return { ...state, myFringeOpen: action.open, detail: action.open ? null : state.detail };

    case 'RESET_ALL_FILTERS': {
      const daysOn: Record<DayKey, boolean> = {};
      for (const d of action.days) daysOn[d] = true;
      const venuesOn: Record<string, boolean> = {};
      for (const v of action.venues) venuesOn[v] = true;
      const ratingsOn: Record<string, boolean> = {};
      for (const r of action.ratings) ratingsOn[r] = true;
      const warningsOn: Record<string, boolean> = {};
      for (const w of action.warnings) warningsOn[w] = true;
      const timeBucketsOn = allTimeBucketsOn();
      return {
        ...state,
        daysOn,
        venuesOn,
        ratingsOn,
        warningsOn,
        timeBucketsOn,
        excluded: {},
        clash: 'show',
        query: '',
      };
    }

    default:
      return state;
  }
}
