# Working in this repo

Read `README.md` first - it documents the upstream API quirks that explain why
`scripts/scrape.mjs` looks the way it does. The rules below are the short version.

## Rules

- **`src/data/show_times.json` is generated. Never hand-edit it.** Change
  `scripts/scrape.mjs` and re-run `npm run scrape`. It holds only what the scraper can
  see upstream: show IDs, titles, and performance times.
- **`src/data/shows_meta.json` and `src/data/venues.json` are generated too**, by
  `scripts/scrape_meta.mjs`. They hold everything `scrape.mjs` can't get: credits,
  rating, content warnings, and venue addresses. Refresh with `npm run scrape:meta`.
- **No dependencies in either scraper.** Node built-ins only (`fetch`, `node:fs`,
  `node:url`). The root `package.json` belongs to the front-end - the `scrape` scripts in
  it are just aliases, and the scrapers must keep running with nothing installed, so
  don't reach for a library from them.
- **Never pass an API `dateStart` to `new Date()`.** It carries a trailing `Z` but holds
  Halifax local wall time. Strip the `Z` and keep timestamps as naive local strings
  (`2026-09-03T14:00`). This is the single easiest way to silently break every showtime
  by three hours. Same rule downstream: the front-end never parses a stored timestamp
  either - `src/lib/dates.ts` owns all of it (`splitNaiveTimestamp`, `addDays`,
  `dayKeysBetween`, `nowInHalifax`). A `new Date()` built from plain y/m/d integers is
  fine; one built from a string is not.
- **Read "now" from `useNow()`, not `nowInHalifax()`, inside a component.** A value read
  during render can't be a dependency and can't update, so it freezes at page-open time.
- **The scraper merges; it must never delete.** Showtimes that vanish upstream get
  `status: "cancelled"`, not removal - a starred pick disappearing without a trace is the
  specific failure this design exists to prevent.
- **`timeId` is the stable key for UI state.** Don't renumber, reassign, or derive it from
  array position. Saved and shared schedules are encoded as `timeId`s
  (`src/lib/persistence.ts`) precisely so a cancellation upstream can't shift a pick onto
  a different showtime. The original design handoff specified a position-based
  encoding, and that's the bug - if it resurfaces from anywhere, it isn't a fix.
- **Every view is a single component tree; CSS alone decides how it looks at each
  width.** `PageHeader`, `CardBrowser`, and `GridPlanner` used to each duplicate into an
  `X`/`XMobile` pair, both mounted and switched by a `display:none` media query - that's
  gone. There's one `<CardBrowser>`, one `<GridPlanner>`; viewport-dependent differences
  (sticky label column width, spacing, wordmark truncation, the ON NOW badge) are CSS
  custom properties and `@media` blocks on the same selectors, never a JS prop or a
  second component. `DetailPanel` is the pattern to copy for anything new - one
  component, CSS alone flips it from a side panel to a full-screen overlay.
  **Watch source order inside a CSS Modules file**: a base rule and its `@media`
  override share the same specificity (both are plain single-class selectors), so the
  override has to come *after* the base rule in the file, or the base rule wins
  regardless of which media query is active. This exact bug shipped once - a base
  rule below its own `@media (max-width: 700px)` override silently cancelled it - and
  the Playwright pass below is what caught it, not vitest.
  Four breakpoints, each meaning something different:
  - `1100px` - card grid drops 3 columns to 2.
  - `1000px` - the 300px My Fringe rail hides, freeing card-grid width.
  - `700px` - the compact breakpoint: sticky label column narrows, "Halifax " drops
    from the wordmark, spacing tightens throughout.
  - `520px` - phone tweaks: legend hidden, "Planner" drops from the wordmark too.
    (No longer bumps FilterButton/SegmentedControl padding for a 44px touch target -
    once the FilterBar became a single component rendered at every width, that bump
    made Venue/Shows/Grid/Cards visibly taller than their neighbors in the same row,
    which read as broken rather than deliberate.)
- **No genre field.** Genre data isn't available on the festival website or in the PDF
  guide. Don't invent one - the front-end has no genre filter or genre-coded accents.
- **Don't commit the festival PDF** (it's gitignored - 32MB).

## Testing scraper changes

Verify with a real run, not by reasoning about the diff:

1. `npm run scrape` - expect 56 shows / 282 showtimes, exit 0.
2. Run it twice. The second run must print "No changes since the last run" and leave
   `src/data/show_times.json` byte-identical apart from `scrapedAt`. Churn on a clean re-run means
   the merge keying is broken.
3. To exercise cancel/reschedule/revive, back `src/data/show_times.json` up, mutate the copy in
   place, re-scrape, then **restore the good file**. Don't leave test mutations committed.

Spot-check that survives any refactor: show `284247` has 7 showtimes, and its Sep 3
performances are at `14:00` and `17:00`.

## Testing front-end changes

```bash
npm test          # vitest run
npx tsc -b        # the build runs this too
npm run lint      # oxlint
```

Two habits that have caught real bugs here:

- **Write the failing test first, then check it fails for the right reason** - revert the
  fix, watch the new test go red, put the fix back. Several of these tests would have
  passed against the broken code otherwise.
- **`fireEvent.click` does not dispatch `mousedown`**, but a real tap does. Anything
  involving outside-click, dismissal or drag needs the lower-level event, or the test
  passes while the feature is unusable.
- **jsdom does no layout, so vitest cannot see a layout bug.** The two worst defects this
  app has had - every card overlapping the one below it, and the rail footer painting
  over the picks - were both invisible to a green suite, and so was a real CSS source-order
  bug in the desktop/mobile merge (see above) that silently kept the ON NOW badge visible
  under 700px. Run `npm run test:visual` (`e2e/viewport-check.mjs`, a plain script against
  the `playwright` devDependency - no test runner installed): it renders the real app at
  1440 / 1000 / 620 / 520 / 390, hit-tests the live DOM and computed styles, and screenshots
  along the way, rather than reading CSS and reasoning about it. Any change to grid, flex,
  overflow ownership, or a breakpoint needs that pass, not just `npm test`. Both layout bugs
  came from a container with a *definite* height sizing its children to fit rather than to
  their content; the diagnoses are written up in `CardGrid.module.css` and
  `MyFringeRail.module.css` where they can't drift.
