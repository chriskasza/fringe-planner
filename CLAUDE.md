# Working in this repo

Read `README.md` first - it documents the upstream API quirks that explain why
`scraper/scrape.mjs` looks the way it does. The rules below are the short version.

## Rules

- **`src/data/show_times.json` is generated. Never hand-edit it.** Change
  `scraper/scrape.mjs` and re-run `npm run scrape`. It holds only what the scraper can
  see upstream: show IDs, titles, and performance times.
- **`src/data/shows_meta.json` and `src/data/venues.json` are generated too**, by the
  same `scraper/scrape.mjs` / `npm run scrape` as `show_times.json`. They hold
  everything the pin board and times API can't get: the full description, credits,
  rating, content warnings, and venue addresses, scraped from each show's own SimpleTix
  ticket page. `show_times.json`'s `blurb` is the pin board's 256-character teaser;
  `shows_meta.json`'s `description` is the untruncated version, and `DetailPanel`
  expands from one to the other.
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
  (sticky label column width, spacing, wordmark truncation) are CSS
  custom properties and `@media` blocks on the same selectors, never a JS prop or a
  second component. `DetailPanel` is the pattern to copy for anything new - one
  component, CSS alone flips it from a side panel to a full-screen overlay.
  `MyFringePanel` now follows the same pattern and the same 318px width (it used to be
  an always-`position:fixed` 300px drawer mounted once at the App level - see
  `state.ts`'s `SET_DETAIL`/`SET_MY_FRINGE_OPEN`): the two panels are mutually
  exclusive, so they read as one panel that swaps content rather than two different
  UI elements.
  **Watch source order inside a CSS Modules file**: a base rule and its `@media`
  override share the same specificity (both are plain single-class selectors), so the
  override has to come *after* the base rule in the file, or the base rule wins
  regardless of which media query is active. This exact bug shipped once - a base
  rule below its own `@media (max-width: 700px)` override silently cancelled it - and
  the Playwright pass below is what caught it, not vitest.
  Three breakpoints, each meaning something different:
  - `1100px` - card grid drops 3 columns to 2.
  - `700px` - the compact breakpoint: sticky label column narrows to 66px and swaps to
    the short-form venue label (`Show.venueShortMobile`, see `VenueMetaEntry.shortMobile`
    in `types.ts`/`venues.json` - not just `venueShort` clamped smaller, since several
    venues' `short` values contain a single unbreakable token too wide for 66px; the
    curated values live in `scrape.mjs`'s `SHORT_MOBILE_NAMES`, next to `SHORT_NAMES`,
    because the scraper rewrites each `venues.json` entry wholesale and would otherwise
    delete a value that existed only in the generated file), the
    grid's per-slot pixel width drops from 140px to 88px (`gridLayout.ts`'s
    `slotWidth`/`useIsNarrow` - this one can't be CSS-only, since blocks are positioned
    with pixel math, not grid columns), "Halifax " drops from the wordmark, spacing
    tightens throughout, and `DetailPanel`/`MyFringePanel` both switch from a static
    side panel to a full-screen overlay.
  - `520px` - phone tweaks: "Planner" drops from the wordmark too, leaving just
    "Fringe". (No longer bumps FilterButton/SegmentedControl padding for a 44px touch
    target - once the FilterBar became a single component rendered at every width,
    that bump made Venue/Shows/Grid/Cards visibly taller than their neighbors in the
    same row, which read as broken rather than deliberate.)
- **Don't dim de-emphasized text with `opacity`.** The muted text tokens in
  `src/styles/tokens.css` (`--text-faint`, `--text-mute`, ...) are tuned to just clear
  WCAG AA (4.5:1) against the four dark background tokens directly. Wrapping one of
  them in a whole-element `opacity` - as `DayRail`, `CheckboxRow`, `FilterBar`,
  `SyncSheet`, and `MyFringePanel` each separately did, to signal a dimmed/disabled/
  outside-filter row - blends both the text and its background toward whatever's
  behind the element, which silently drops the *effective* contrast well below the
  token's own passing value (as low as 2.5:1 in one case, on a token that's 5:1+ on
  paper). An accessibility scanner catches this; `npm test`/`tsc`/lint don't, since
  the raw color values never change. If a row needs to look de-emphasized, change its
  `color` (there's usually already a token for it, e.g. `--text-mute`) instead of
  reducing the whole element's opacity.
- **Never nest a real interactive element inside another interactive element**,
  including a `role="button"`/`tabIndex` div standing in for one. `GridBlock` used to
  be a `role="button"` div (the pick-toggle) wrapping a real `<button>` (the "ⓘ"
  details `IconButton`) - a nested-interactive violation that also needed a
  `stopPropagation()` workaround in `IconButton` just to stop one click from firing
  both actions. Fixed by making them DOM siblings instead: an inert positioning `<div>`
  (`.grid-block`, `overflow: visible`) containing a real `<button>` for the primary
  action (`.grid-block__surface`, full-size, no visible content of its own) and a
  second sibling (`.grid-block__sticky`) that paints the icon, title and meta line on
  top of it. The sticky group sets `pointer-events: none` on itself so a click on the
  visible title/meta text falls straight through to the surface button underneath;
  `IconButton` opts back in with `pointer-events: auto`, which is what makes it
  independently clickable without ever being the surface button's descendant, and
  without needing a `stopPropagation()` workaround. `GridBlock.tsx` /
  `GridPlanner.module.css`'s `.grid-block__sticky`/`.grid-block__icon` is the pattern
  to copy for any future "card with a corner (or pinned) action button" that also
  needs to keep working while its surface scrolls. Same blind spot as the opacity note
  above: `tsc`/`npm test`/lint don't catch this, only an accessibility scanner (or the
  browser's own accessibility tree inspector) does.
- **No genre field.** Genre data isn't available on the festival website or in the PDF
  guide. Don't invent one - the front-end has no genre filter or genre-coded accents.
- **Don't commit the festival PDF** (it's gitignored - 32MB).

## Testing scraper changes

Verify with a real run, not by reasoning about the diff:

1. `npm run scrape` - expect 56 shows / 288 showtimes (282 active), exit 0. The active
   count is the stable one; the total grows whenever upstream cancels and re-issues a
   performance, since cancelled entries are kept forever.
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
  over the picks - were both invisible to a green suite. Run `npm run test:visual` 
  (`e2e/viewport-check.mjs`, a plain script against
  the `playwright` devDependency - no test runner installed): it renders the real app at
  1440 / 1000 / 620 / 520 / 390, hit-tests the live DOM and computed styles, and screenshots
  along the way, rather than reading CSS and reasoning about it. Any change to grid, flex,
  overflow ownership, or a breakpoint needs that pass, not just `npm test`. Both layout bugs
  came from a container with a *definite* height sizing its children to fit rather than to
  their content; the diagnoses are written up in `CardGrid.module.css` and
  `MyFringePanel.module.css` where they can't drift.
