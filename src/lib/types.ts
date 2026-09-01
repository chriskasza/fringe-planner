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
  // Cancelled by the artist upstream (the pin board prefixes such a title with
  // "CANCELLED:"). Distinct from `status`, which only says whether the show is
  // still listed at all: a cancelled show stays on the pin board, keeps its
  // page, and keeps `status: 'active'`, but every entry in `times` is
  // cancelled and no new one is ever scraped.
  cancelled?: boolean;
  // The festival's own free events ("FREE - Late Night Cabaret (No Tickets
  // Required, Just Show Up!)") say so only in their pin board title, which the
  // scraper strips into a clean `title` plus this flag. Not named `free` --
  // PerfState already uses that for an unclashing empty slot.
  freeAdmission?: boolean;
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
  // The show's full write-up off its own ticket page, one entry per paragraph
  // (everything before the first labelled paragraph - see meta.mjs). Unlike
  // RawShow.blurb, which the pin board truncates to 256 characters, this is
  // the whole thing. Optional: a meta entry carried forward from a scrape
  // that predates this field won't have it.
  description?: string[];
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
  blurb: string; // truncated teaser from the pin board, 256 chars max
  description: string[]; // full write-up, one entry per paragraph; may be empty
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
  // See RawShow.cancelled. Implies every entry in `perfs` is cancelled, so the
  // show never reaches the Grid and its card shows no times - but it stays in
  // the Cards browser and the Shows filter for posterity.
  cancelled: boolean;
  // See RawShow.freeAdmission. Admission is free and no ticket is needed, so
  // the ticket link is relabelled rather than offered as a call to action.
  freeAdmission: boolean;
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
