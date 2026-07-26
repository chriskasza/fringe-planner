# Halifax Fringe 2026 - show planner

Personal tool for picking which Fringe shows and times to attend.

## Updating the data

```bash
node scrape.mjs
```

Re-runnable and safe to run any time. It prints a summary of what changed since the last
run, then `git diff shows.json` shows the detail.

Requires Node 18+ (uses built-in `fetch`). No dependencies, no `npm install`.

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

## Gotchas worth knowing before editing `scrape.mjs`

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

**Ticket URLs only need the ID.** `simpletix.com/e/{slug}-tickets-{showId}` resolves on
the trailing `showId` alone - the slug is cosmetic, so no slugification edge case can
break a link.

## `shows.json`

Accumulated, never destructive. Re-running merges into the existing file:

- A showtime that disappears upstream is **not deleted** - it gets
  `status: "cancelled"` and a `cancelledAt`, so the UI can show it struck through
  instead of silently losing a starred pick.
- A showtime whose `start`, `end`, or `venue` moves is updated in place, with the old
  value appended to a `changes` array.
- A cancelled showtime that reappears upstream flips back to `active`.

`timeId` is the stable identity for a showtime and survives re-scrapes, so UI state keyed
on it stays valid.

The scraper writes via a temp file and rename, and aborts without writing if the pin
board yields fewer than 50 shows or any show returns no showtimes - a partial scrape
would otherwise mass-cancel real showtimes.

Don't hand-edit `shows.json`; change `scrape.mjs` and re-run it. See `CLAUDE.md` for the
full set of working rules.

## Status

- [x] `scrape.mjs` + `shows.json` - 56 shows, 282 showtimes, Sep 3-13 2026
- [] Front-end (design pending)
