# Working in this repo

Read `README.md` first - it documents the upstream API quirks that explain why
`scrape.mjs` looks the way it does. The rules below are the short version.

## Rules

- **`show_times.json` is generated. Never hand-edit it.** Change `scrape.mjs` and re-run
  `node scrape.mjs`. It holds only what the scraper can see upstream: show IDs, titles,
  and performance times.
- **`src/data/shows_meta.json` and `src/data/venues.json` are scraped by `scrape_meta.mjs`, not hand-edited.**
  They hold everything `scrape.mjs` can't get: credits, rating, content warnings,
  and venue addresses. Re-run `node scrape_meta.mjs` to refresh them.
- **No dependencies in `scrape.mjs`.** Node built-ins only (`fetch`, `node:fs`,
  `node:url`). The root `package.json` belongs to the front-end; the scrapers must run
  with nothing installed, so don't reach for a library from them.
- **Never pass an API `dateStart` to `new Date()`.** It carries a trailing `Z` but holds
  Halifax local wall time. Strip the `Z` and keep timestamps as naive local strings
  (`2026-09-03T14:00`). This is the single easiest way to silently break every showtime
  by three hours.
- **The scraper merges; it must never delete.** Showtimes that vanish upstream get
  `status: "cancelled"`, not removal - a starred pick disappearing without a trace is the
  specific failure this design exists to prevent.
- **`timeId` is the stable key for UI state.** Don't renumber, reassign, or derive it from
  array position.
- **No genre field.** Genre data isn't available on the festival website or in the PDF
  guide. Don't invent one - the front-end has no genre filter or genre-coded accents.
- **Don't commit the festival PDF** (it's gitignored - 32MB).

## Testing scraper changes

Verify with a real run, not by reasoning about the diff:

1. `node scrape.mjs` - expect 56 shows / 282 showtimes, exit 0.
2. Run it twice. The second run must print "No changes since the last run" and leave
   `src/data/show_times.json` byte-identical apart from `scrapedAt`. Churn on a clean re-run means
   the merge keying is broken.
3. To exercise cancel/reschedule/revive, back `src/data/show_times.json` up, mutate the copy in
   place, re-scrape, then **restore the good file**. Don't leave test mutations committed.

Spot-check that survives any refactor: show `284247` has 7 showtimes, and its Sep 3
performances are at `14:00` and `17:00`.
