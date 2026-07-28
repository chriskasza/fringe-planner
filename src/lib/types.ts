// Raw shapes as they come out of the scrapers. Never hand-edited - see
// CLAUDE.md. `transform.ts` turns these into the `Show[]` the app renders.

export type RawTime = {
  timeId: number | string;
  start: string; // naive Halifax local time, "2026-09-06T19:30"
  end: string;
  venue: string;
  status: 'active' | 'cancelled';
  firstSeen: string;
  cancelledAt?: string;
  changes?: { at: string; field: string; from: string; to: string }[];
};

export type RawShow = {
  showId: number;
  title: string;
  blurb: string;
  poster: string;
  venue: string;
  ticketUrl: string;
  times: RawTime[];
  status: 'active' | 'cancelled';
  firstSeen: string;
  salesEnded?: boolean;
  timesIncomplete?: boolean;
};

export type ShowTimesFile = {
  scrapedAt: string;
  timezone: string;
  source: string;
  shows: RawShow[];
};

export type ShowMetaEntry = {
  credits: string[];
  rating: string;
  warnings: string[];
  // Only present for shows the API gives no venue for - recovered from the
  // show page's own JSON-LD by scrape_meta.mjs.
  venue?: string;
};

export type ShowsMetaFile = Record<string, ShowMetaEntry>;

export type VenueMetaEntry = {
  short: string;
  shortAddress: string | null;
  fullAddress: string | null;
};

export type VenuesFile = Record<string, VenueMetaEntry>;

// --- App-facing model ------------------------------------------------------

export type DayKey = string; // ISO date, "2026-09-03"

export type Day = {
  key: DayKey;
  dow: string; // "THU"
  dateNum: number; // 3
  label: string; // "Thu 3 Sep"
  count: number; // active performances that day, across all shows
};

export type PerfStatus = 'active' | 'cancelled';

// The upstream-stable id (see CLAUDE.md) - stringified once at the raw->Perf
// boundary in transform.ts, so nothing downstream ever sees `number | string`.
export type TimeId = string;

export type Perf = {
  timeId: TimeId;
  showId: string;
  day: DayKey;
  start: number; // minutes from midnight
  end: number;
  mins: number;
  status: PerfStatus;
};

export type Show = {
  id: string;
  title: string;
  blurb: string;
  poster: string;
  ticketUrl: string;
  venue: string;
  venueShort: string;
  venueAddress: string | null;
  credits: string[];
  rating: string;
  warnings: string[];
  mins: number; // typical performance length, for card display
  salesEnded: boolean;
  timesIncomplete: boolean;
  perfs: Perf[]; // active and cancelled, sorted by day then start
};

// `${showId}|${day}|${start}` - the unit the user picks, never the show.
export type PerfKey = string;

export type ClashMode = 'show' | 'hide';

export type ViewMode = 'grid' | 'cards';

// Time-of-day buckets for the Time filter (the handoff styles the button but
// leaves the panel's contents unspecified). Boundaries are fitted to the real
// 2026 showtimes, which cluster into daytime / early-evening / night:
// 71 performances before 5pm, 100 between 5 and 8, 111 from 8 onward.
export type TimeBucket = 'matinee' | 'evening' | 'night';

// 'all' is the overflow filters modal (every filter stacked in one sheet,
// rather than a single inline dropdown) - stored in the same per-view
// openMenu slot as the others.
export type MenuKey = 'day' | 'time' | 'venue' | 'age' | 'content' | 'clash' | 'shows' | 'all' | null;

// Which show and which specific performance opened the detail panel - the
// panel's TIME/VENUE/LENGTH fields describe this one performance, and every
// other active performance of the show lists in "Other performances".
export type DetailTarget = { showId: string; perfKey: PerfKey };
