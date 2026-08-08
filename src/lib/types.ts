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
  // Unedited, as the creator typed it into their SimpleTix listing (split on
  // commas/newlines and lower-cased - see meta.mjs). For display only; never
  // filter on this, it's dozens of near-duplicate freeform phrases.
  warnings: string[];
  // The above, collapsed onto a short fixed category list (meta.mjs's
  // WARNING_CATEGORIES) - this is what the Content Warning filter uses.
  warningTags: string[];
  // Only present for shows the API gives no venue for - recovered from the
  // show page's own JSON-LD by the scraper (scraper/scrape.mjs).
  venue?: string;
};

export type ShowsMetaFile = Record<string, ShowMetaEntry>;

export type VenueMetaEntry = {
  short: string;
  // Mobile-safe variant of `short`: every space-separated token is 8
  // characters or fewer, so it can never overflow the narrow (66px) mobile
  // grid label column, whether wrapped or not. Optional - falls back to
  // `short` (see transform.ts) so a venue added by a re-scrape without this
  // field still renders, just without the mobile-specific abbreviation.
  shortMobile?: string;
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
  // See VenueMetaEntry.shortMobile - the mobile grid label column renders
  // this instead of venueShort below 700px.
  venueShortMobile: string;
  venueAddress: string | null;
  credits: string[];
  rating: string;
  warnings: string[]; // raw, unedited - display only, see ShowMetaEntry
  warningTags: string[]; // condensed categories - what the filter uses
  mins: number; // typical performance length, for card display
  salesEnded: boolean;
  timesIncomplete: boolean;
  perfs: Perf[]; // active and cancelled, sorted by day then start
};

export type ClashMode = 'show' | 'hide';

export type ViewMode = 'grid' | 'cards';

// Card Browser sort order. Named 'soonest' rather than 'time' so it doesn't
// read like the Time-of-day filter's MenuKey.
export type SortMode = 'random' | 'title' | 'soonest';

// Time-of-day buckets for the Time filter (the handoff styles the button but
// leaves the panel's contents unspecified). Boundaries are fitted to the real
// 2026 showtimes, which cluster into daytime / early-evening / night:
// 71 performances before 5pm, 100 between 5 and 8, 111 from 8 onward.
export type TimeBucket = 'matinee' | 'evening' | 'night';

// 'all' is the overflow filters modal (every filter stacked in one sheet,
// rather than a single inline dropdown) - stored in the same per-view
// openMenu slot as the others.
export type MenuKey = 'day' | 'time' | 'venue' | 'age' | 'content' | 'clash' | 'shows' | 'sort' | 'all' | null;

// Which specific performance opened the detail panel - the panel's
// TIME/VENUE/LENGTH fields describe this one performance, and every other
// active performance of its show lists in "Other performances".
export type DetailTarget = { timeId: TimeId };
