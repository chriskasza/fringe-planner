# Halifax Fringe 2026 - show planner

Personal tool for picking which Fringe shows and times to attend.

## Updating the data

```bash
npm run scrape        # node scraper/scrape.mjs
```

Re-runnable and safe to run any time. It prints a summary of what changed since the last
run, then `git diff src/data/show_times.json` shows the detail.

Requires Node 18+ (uses built-in `fetch`). The scrapers have no dependencies and need no
`npm install` - that's only for the front-end.

## Data sources

Three upstream endpoints, all discovered by watching what the festival's own ticket
widget calls:

1. **Show list** - `contact.simpletix.com/Calendar/GetPinBoard?applicationId=...`
   Returns the show-card HTML: `showId`, title, poster, blurb.

   The public tickets page at `halifaxfringe.ca/home-copy-copy-3/` renders these cards
   client-side, so fetching *that* URL returns no shows. Scrape the pin board instead.
   Its `limit` parameter is capped at 100 - anything higher 400s.

2. **Showtimes + venue** - `api.prod.simpletix.com/embed/Event/GetMultiTimeSelectionData/{showId}`
   Requires the headers `application`, `isBoxOffice: 0`, `originType: 9`.

3. **Show page** - `simpletix.com/e/{slug}-tickets-{showId}` - each show's own ticket
   page, scraped for the full description, credits, rating, content warnings, and (via
   its JSON-LD) the venue's address. The pin board's own blurb is truncated to 256
   characters upstream, so the untruncated write-up only exists here. See "Data that
   isn't scraped" below.

## Gotchas worth knowing before editing `scraper/scrape.mjs`

**Timestamps lie about their timezone.** The API returns `dateStart` with a trailing `Z`,
but the value is *Halifax local wall time*, not UTC - `2026-09-03T14:00:00Z` is the 2:00 PM
show. (`dateStartUtc` holds the real UTC.) The scraper strips the `Z` and stores naive
local strings like `2026-09-03T14:00`. Never hand `dateStart` to `new Date()`, or every
showtime shifts by three hours.

**Not every show has an `eventTimes` array.** Three cases exist in the current data:

- Normal shows: `eventTimes` is populated, each entry with a real `timeId`.
- Single-performance shows (*Metal Box*, *Whose Presentation Is It Anyway?*):
  `eventTimes` is `null` and the one slot lives in `showStartDate`/`showEndDate`.
- Sales-ended shows (*Game of drones... Drummers Are Coming*): the endpoint returns HTTP
  406 "Tickets Sales Ended". The payload still carries usable metadata, so a 406 is not
  treated as fatal.

Showtimes recovered from the last two cases have no upstream `timeId`, so the scraper
synthesises one as `s{showId}-{start}`.

**When `eventTimes` is empty, the show page's JSON-LD fills the gaps.** The date-wise
fallback is the only path that can under-report: *Game of drones* is a free outdoor
roving event, and the API listed two of the three performances its own page does. So
whenever `eventTimes` comes back empty, the scraper reads every `Event` out of the page's
`ld+json` block (already fetched for the meta pass, so no extra request) and adds any
slot the API missed. It only ever *adds* - a slot the API knows and the page doesn't is
kept.

**That JSON-LD is the one upstream timestamp that means what it says.**
`2026-09-04T20:45:00+00:00` really is 20:45 UTC, i.e. 17:45 in Halifax - the exact
opposite of the embed API's `dateStart`. `halifaxStamp` converts it and `localStamp`
must never be pointed at it (or vice versa); each would shift the other's times by three
hours and look entirely plausible. Because that mistake is so easy to make and so quiet,
the merge is guarded: the page's times must be a **superset** of the ones the API already
gave, or the scraper warns and adds nothing. A three-hour shift fails that check on every
show rather than corrupting the data.

*Game of drones* still has an empty `venue` upstream (the page says "Outdoors - Different
Locations"), and its three slots are each at a different location - something only its
description prose records.

**A cancelled show is marked only in its title.** When an artist cancels, the festival
prefixes the pin board title - `CANCELLED: All Below` - and rewrites the blurb, but
nothing else changes: the show keeps its card, its ticket page still lists its old
showtimes, and the embed API keeps answering. So the title prefix is the only signal
worth trusting, and `isCancelledTitle` in `scraper/lib/util.mjs` is what reads it.

A cancellation also always coincides with sales ending, which drops `eventTimes` and
sends the show down the synthetic-`timeId` path above. That combination is a trap: the
synthesised ids don't match the real ones, so the merge cancels the three genuine
showtimes and writes three *new, active* ones for slots that no longer exist. The scraper
therefore skips `resolveTimes` entirely for a cancelled show and emits no times at all,
which lets the merge cancel everything it knows about - the truth. The show is flagged
`cancelled: true`; its `status` stays `active`, since that field only tracks whether
upstream still lists the show.

The front-end keeps a cancelled show in the Cards browser and the Shows filter for
posterity. With no active performances it has no dates to match, so `visible()`
(`src/lib/derived.ts`) lets it skip the Day/Time filters while Venue, Rating, Content
Warnings, the Shows exclusion list and search still apply. It sorts last, its card shows
`CANCELLED · NO PERFORMANCES` in place of the day rail and time pills, its detail panel
reads `CANCELLED` for TIME and offers no pick button, and it never reaches the Grid.

`cancelled`, `salesEnded` and `timesIncomplete` describe the show's *current* upstream state, so
unlike everything else in the file they are cleared when a show recovers - the
`CANCELLED:` prefix coming off the title, sales reopening, or the API returning a full
`eventTimes` again. Everything else the merge
touches is history and is kept.

**Ticket URLs only need the ID.** `simpletix.com/e/{slug}-tickets-{showId}` resolves on
the trailing `showId` alone - the slug is cosmetic, so no slugification edge case can
break a link.

## `src/data/show_times.json`

Accumulated, never destructive. Re-running merges into the existing file:

- A showtime that disappears upstream is **not deleted** - it gets
  `status: "cancelled"` and a `cancelledAt`, so the UI can show it struck through
  instead of silently losing a starred pick.
- A showtime whose `start`, `end`, or `venue` moves is updated in place, with the old
  value appended to a `changes` array.
- A cancelled showtime that reappears upstream flips back to `active`.

`timeId` is the stable identity for a showtime and survives re-scrapes, so UI state keyed
on it stays valid. Saved and shared schedules are keyed on it too (see *Picks live in the
URL* below), which is what makes them survive a cancellation upstream.

The scraper writes via a temp file and rename, and aborts without writing if the pin
board yields fewer than 50 shows or any show returns no showtimes - a partial scrape
would otherwise mass-cancel real showtimes. A show marked `CANCELLED:` upstream is exempt
from the second guard: zero showtimes is the correct answer for it, not a failure.

Don't hand-edit `src/data/show_times.json`; change `scraper/scrape.mjs` and re-run it. See
`CLAUDE.md` for the full set of working rules.

## Data that isn't scraped

The SimpleTix API has no genre, company/artist, rating, or content-warning fields, and
the festival guide PDF doesn't reliably fill those gaps either - so `show_times.json`
only ever has what the scraper can actually observe: show IDs, titles, blurbs, and
performance times.

Additional show metadata and venue addresses are scraped from each show's own SimpleTix
page by `scraper/scrape.mjs` and written to `src/data/`:

- **`shows_meta.json`** - one entry per `showId`: `description` (the full write-up, one
  entry per paragraph - everything before the first `Credits:`/`Rating:`/`Content
  Warnings:` paragraph on the page), `credits`, `rating`, `warnings`.
- **`venues.json`** - one entry per venue name: `short`, `shortAddress`, `fullAddress`,
  plus a curated `shortMobile` for the venues whose `short` is too wide for the 66px
  mobile label column.

The front-end's `transform.ts` joins all three files into the shape the UI renders. There
is deliberately no genre field or genre filter anywhere in the app.

## The front-end

```bash
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm test         # vitest run
```

Built from a design handoff that is no longer in the repo - the designs are implemented,
so the bundle was dropped. A few decisions below read as odd without it, because they are
places the implementation deliberately went against what that spec prescribed. The
reasoning is kept here so they don't get "corrected" back into bugs.

### Picks live in the URL

The schedule is encoded into the hash on a 250ms debounce with `history.replaceState`,
and mirrored to `localStorage` for anyone arriving at the bare URL. The Sync sheet builds
its share link and QR code from the same string.

- **Tokens are `timeId`s**, dot-separated - not the spec's base-36 show id + letter.
  That scheme encoded a performance's *position* in the show's active list, so a single
  cancellation upstream shifted every later pick onto the wrong showtime, silently. The
  festival's own `timeId`s are unique across all 277 active performances, so a token needs no
  show prefix. Links are a little longer and stay well inside QR limits.
- **`popstate` is not guarded by an "I wrote this" flag**, as the spec called for.
  `replaceState` never fires `popstate`, so such a flag is only ever cleared by the first
  genuine Back - which is then swallowed. The handler compares the URL against what's on
  screen instead.
- **Back does not undo a pick.** The spec made that optional (`pushState` per action);
  picks use `replaceState` only, so they don't fill the history stack.
- The Sync sheet's restore box accepts a full schedule link, a bare token string, or the
  `.json` backup it writes. The backup carries `timeId` per pick for exact restores.
- Filter state is deliberately not in the URL - only picks are, so a shared schedule link
  never forces the app's own filter view onto whoever opens it.

### Filters persist to localStorage, not the URL

Day/venue/rating/content-warning/time toggles, the Shows search exclusion list, clash
mode, the search query, and the Card Browser's sort order survive a reload via
`src/lib/filterPersistence.ts`, on the same 250ms debounce as picks but written to
`localStorage` only (`fringe-filters`) - no hash, no `history.replaceState`, no
`popstate` listener, since there's no share-link case to support. Sort isn't really a
filter - it doesn't narrow what's browsable, and Reset All deliberately leaves it alone
(see `src/lib/state.ts`) - but it's stored alongside clash/query anyway, as the same kind
of personal, non-shareable display preference.

- **Only the delta from default is stored** - the off keys for the opt-out maps
  (`daysOn`/`timeBucketsOn`/`venuesOn`/`ratingsOn`/`warningsOn`, which default all-on) and
  the excluded ids for `excluded` (which defaults all-off) - not every key, mirroring how
  picks store just the picked set rather than every performance.
- **A saved blob is merged onto a freshly computed default, never substituted for it.**
  `decodeFilters` takes the just-computed `createInitialState` result and only flips keys
  it has an explicit saved entry for; a key with no entry keeps whatever that fresh
  computation already decided. This is what lets `daysOn`'s date-dependent default (days
  before today start off) apply correctly to a day that wasn't in the saved blob at all,
  and what makes a brand-new venue/rating/warning from a re-scrape default to visible
  instead of silently hidden.
- Stale keys (a venue/rating/warning/day/showId no longer in the current data) are
  dropped individually, same as a junk `timeId` token in a picks link - one bad entry
  doesn't cost the rest of the restore.
- **Known gap**: because only off-keys are stored, explicitly re-enabling an
  already-past day won't round-trip - the next load's fresh default is `false` for that
  day either way, so there's no saved marker to distinguish "turned back on" from "never
  touched." Narrow enough (re-viewing an already-past day) that it's accepted rather than
  fixed with bidirectional deltas.

### Time is always Halifax wall-clock

The same rule as the scraper, on the front-end side: timestamps in `show_times.json` are
naive local strings, so nothing parses them with `new Date()`. `src/lib/dates.ts` owns
the arithmetic (`splitNaiveTimestamp`, `addDays`, `dayKeysBetween`, `nowInHalifax`), and
components read "now" from the `useNow` hook rather than calling `nowInHalifax()` during
render - a value read during render has no way to update, and the current day's grid 
axis silently froze at page-open time when they did that.

On today's date, performances that have already **finished** drop off the grid; one
that's still running keeps its block. Days before today start deselected in the Day
filter, and the app opens on the first day from today forward that has shows.

## Status

- [x] `scraper/scrape.mjs` + `src/data/show_times.json` / `shows_meta.json` / `venues.json` - 56 shows, 289 showtimes (277 active), Sep 3-13 2026
- [x] Front-end - Grid Planner, Card Browser, Sync sheet, desktop + mobile
