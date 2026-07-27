# Halifax Fringe 2026 - show planner

Personal tool for picking which Fringe shows and times to attend.

## Updating the data

```bash
npm run scrape        # node scripts/scrape.mjs
```

Re-runnable and safe to run any time. It prints a summary of what changed since the last
run, then `git diff src/data/show_times.json` shows the detail.

Requires Node 18+ (uses built-in `fetch`). The scrapers have no dependencies and need no
`npm install` - that's only for the front-end.

## Data sources

Two upstream endpoints, both discovered by watching what the festival's own ticket
widget calls:

1. **Show list** - `contact.simpletix.com/Calendar/GetPinBoard?applicationId=...`
   Returns the show-card HTML: `showId`, title, poster, blurb.

   The public tickets page at `halifaxfringe.ca/home-copy-copy-3/` renders these cards
   client-side, so fetching *that* URL returns no shows. Scrape the pin board instead.
   Its `limit` parameter is capped at 100 - anything higher 400s.

2. **Showtimes + venue** - `api.prod.simpletix.com/embed/Event/GetMultiTimeSelectionData/{showId}`
   Requires the headers `application`, `isBoxOffice: 0`, `originType: 9`.

## Gotchas worth knowing before editing `scripts/scrape.mjs`

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

**One show's data is knowingly incomplete.** *Game of drones* is a free outdoor roving
event; its SimpleTix page lists three performances but the API only knows of two. It is
flagged `timesIncomplete: true` and the scraper prints a warning rather than silently
under-reporting. Its `venue` is empty upstream too (the page says "Outdoors - Different
Locations").

`salesEnded` and `timesIncomplete` describe the show's *current* upstream state, so
unlike everything else in the file they are cleared when a show recovers - sales
reopening, or the API returning a full `eventTimes` again. Everything else the merge
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
would otherwise mass-cancel real showtimes.

Don't hand-edit `src/data/show_times.json`; change `scripts/scrape.mjs` and re-run it. See
`CLAUDE.md` for the full set of working rules.

## Data that isn't scraped

The SimpleTix API has no genre, company/artist, rating, or content-warning fields, and
the festival guide PDF doesn't reliably fill those gaps either - so `show_times.json`
only ever has what the scraper can actually observe: show IDs, titles, blurbs, and
performance times.

Additional show metadata and venue addresses are scraped from each show's own SimpleTix
page by `scripts/scrape_meta.mjs` and written to `src/data/`:

- **`shows_meta.json`** - one entry per `showId`: `credits`, `rating`, `warnings`.
- **`venues.json`** - one entry per venue name: `short`, `shortAddress`, `fullAddress`.

Run `npm run scrape:meta` to refresh both.

The front-end's `transform.ts` joins all three files into the shape the UI renders. There
is deliberately no genre field or genre filter anywhere in the app.

## The front-end

```bash
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm test         # vitest run
```

Design spec lives in `design_handoff_fringe_show_selector/`. Where the implementation
knowingly departs from it, the reason is below - don't "restore" these to the spec.

### Picks live in the URL

The schedule is encoded into the hash on a 250ms debounce with `history.replaceState`,
and mirrored to `localStorage` for anyone arriving at the bare URL. The Sync sheet builds
its share link and QR code from the same string.

- **Tokens are `timeId`s**, dot-separated - not the handoff's base-36 show id + letter.
  That scheme encoded a performance's *position* in the show's active list, so a single
  cancellation upstream shifted every later pick onto the wrong showtime, silently. The
  festival's own `timeId`s are unique across all 282 performances, so a token needs no
  show prefix. Links are a little longer and stay well inside QR limits.
- **`popstate` is not guarded by an "I wrote this" flag**, as the spec suggests.
  `replaceState` never fires `popstate`, so such a flag is only ever cleared by the first
  genuine Back - which is then swallowed. The handler compares the URL against what's on
  screen instead.
- **Back does not undo a pick.** The spec makes that optional (`pushState` per action);
  picks use `replaceState` only, so they don't fill the history stack.
- The Sync sheet's restore box accepts a full schedule link, a bare token string, or the
  `.json` backup it writes. The backup carries `timeId` per pick for exact restores.
- Filter state is deliberately not in the URL. Only picks are.

### Time is always Halifax wall-clock

The same rule as the scraper, on the front-end side: timestamps in `show_times.json` are
naive local strings, so nothing parses them with `new Date()`. `src/lib/dates.ts` owns
the arithmetic (`splitNaiveTimestamp`, `addDays`, `dayKeysBetween`, `nowInHalifax`), and
components read "now" from the `useNow` hook rather than calling `nowInHalifax()` during
render - a value read during render has no way to update, and both the ON NOW pill and
the current day's grid axis silently froze at page-open time when they did that.

On today's date, performances that have already **finished** drop off the grid; one
that's still running keeps its block. Days before today start deselected in the Day
filter, and the app opens on the first day from today forward that has shows.

## Status

- [x] `scripts/scrape.mjs` + `src/data/show_times.json` - 56 shows, 282 showtimes, Sep 3-13 2026
- [x] `scripts/scrape_meta.mjs` + `shows_meta.json` / `venues.json`
- [x] Front-end - Grid Planner, Card Browser, Sync sheet, desktop + mobile
