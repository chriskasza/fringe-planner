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
- **The show page's JSON-LD is the one exception to the timestamp rule below, and it
  needs its guard.** When the embed API returns no `eventTimes`, the scraper fills gaps
  from the page's `ld+json` (`extractEventTimes` in `meta.mjs`) - that's how *Game of
  drones* gets its third performance, which the API doesn't list. Unlike everything else
  upstream, those `startDate`s are honest UTC (`2026-09-04T20:45:00+00:00` = 17:45
  Halifax), so `halifaxStamp` converts them and `localStamp` must never touch them; the
  two are three hours apart and both look plausible. `mergePageTimes` (`scrape.mjs`)
  therefore refuses to add anything unless the page's times are a **superset** of the
  API's, which turns that mistake into a warning instead of silently wrong showtimes.
  If you change either function, verify by breaking it on purpose: swapping in
  `localStamp` must make the scrape warn about all three fallback shows and add nothing.
- **Never pass an API `dateStart` to `new Date()`.** It carries a trailing `Z` but holds
  Halifax local wall time. Strip the `Z` and keep timestamps as naive local strings
  (`2026-09-03T14:00`). This is the single easiest way to silently break every showtime
  by three hours. Same rule downstream: the front-end never parses a stored timestamp
  either - `src/lib/dates.ts` owns all of it (`splitNaiveTimestamp`, `addDays`,
  `dayKeysBetween`, `nowInHalifax`). A `new Date()` built from plain y/m/d integers is
  fine; one built from a string is not.
- **Read "now" from `useNow()`, not `nowInHalifax()`, inside a component.** A value read
  during render can't be a dependency and can't update, so it freezes at page-open time.
- **The scraper merges; it must never delete.** Showtimes that vanish upstream are
  *retired*, not removed - a starred pick disappearing without a trace is the specific
  failure this design exists to prevent. But "vanished upstream" is ambiguous: the
  festival delists a slot both when it's cancelled and when it's simply been played.
  `retireTime` (`scraper/lib/merge.mjs`) is the one place that's decided - anything
  already started is `status: "ended"` with an `endedAt`, anything still ahead of us is
  `status: "cancelled"` with a `cancelledAt`. It compares `start` against `nowLocal`
  (`halifaxStamp(now)` in `scrape.mjs`); both are naive Halifax stamps, so it's a plain
  string comparison and no stored timestamp ever reaches `new Date()`. Compare `start`,
  **never `end`** - end times are sometimes plainly wrong and several are curated in
  `DURATION_OVERRIDES`. An already-retired slot is returned untouched, which is what keeps
  a same-day re-scrape byte-identical.
  A *show* becomes `ended` in the pass after the merge in `scrape.mjs`, once it has no
  active showtimes left and at least one performance that already started; it's
  `cancelled` only if it left the pin board with performances still to come (a show
  flagged `cancelled: true` upstream is skipped - that flag owns its own UI). This shipped
  wrong once: the Halifax Fringe Sampler played its one performance on Sep 2 and that
  night's scrape wrote it out as a `cancelled` show still wrapping an *active* showtime,
  because the stale-show loop spread `...stale` and never descended into `times`. Left
  unfixed it would have falsely cancelled every show in the file, one day at a time.
  Front-end side, `ended` and `cancelled` part ways: see the rule below.
- **A played performance stays on the board; only a cancelled one is hidden.** The
  front-end filters on `notCancelled` (`src/lib/derived.ts`), never on
  `status === 'active'` - that older test threw away the user's own history. A show
  whose whole run has been played is retired to `status: 'ended'` upstream, and
  dropping it in `transform.ts` also kept it out of `perfIndex`, so `pickedList` could
  no longer resolve a pick on it: the entry vanished from My Fringe, the ICS export and
  shared links, and `persistence.ts` then stripped the saved timeId on the next reload,
  making the loss permanent and silent. A *cancelled* show never happened and has no
  history to keep, so it still goes.
  "Played" has two signals for the same event at different lags, and `isPlayed`
  (`derived.ts`) composes both: `status === 'ended'`, which the scraper only writes on
  its next run, and `isPastPerf` - the clock, which knows the moment the performance
  ends. Components read the clock half through `useNow()`, never `nowInHalifax()`, or
  the block never stops looking bookable.
  Visually it's an orthogonal modifier, not a fifth `PerfState`:
  `.grid-block__surface--played` layers a `--hatch-played` `::after` over whichever of
  the four state rules applies, so the cue is geometrically identical on a gold picked
  block and a raised-ink free one. It must stay *after* those four rules in the file
  (equal specificity - source order decides). The hatch is a translucent *light* tint
  so one declaration serves both fills without either label losing contrast; a dark
  tint would take `--ink-raised` down onto `--ink` and sink the block into its own row.
  Worst text contrast over either stripe tone is 6.6:1. Don't reach for `opacity` here -
  see the token rule below. A background can't reach assistive tech, so the meta line
  reads `2:00 PM · ENDED` and the `aria-label` gains `ended`; that text, not the hatch,
  is what carries the state to a screen reader. Played blocks stay fully interactive -
  a pick can be added or removed after the fact, and `DetailPanel`'s `retired` gate is
  therefore cancelled-only.
- **Every festival day loads switched on, and `gridDay` is what orients the app.**
  `createInitialState` used to deselect days before today, which hid the user's own
  history behind a filter they had to know to reopen. It doesn't any more, so the *only*
  thing pointing the app forward is the landing-day rule - the first day from today
  that has shows - plus `scrollAnchorLeft` (`gridLayout.ts`), which scrolls
  `.grid-body__scroll` to the first performance on that day still to come. Day
  granularity alone stopped being enough once a spent morning stayed on the board.
  That effect is keyed on `gridDay`/`slotWidthPx`, deliberately **not** on `now`:
  re-running it every minute yanks the grid sideways under a user who had scrolled
  somewhere else. `gridTimeBounds` no longer takes `now` at all - the axis always spans
  the day's full range, because the blocks it has to hold now reach back into it.
- **Neither scrape guard may assume a full pin board.** The board legitimately shrinks as
  shows finish their run, so `MIN_EXPECTED_SHOWS` is deliberately low (10) and only exists
  to catch the markup changing under us; it was 50 against a board of 58 and would have
  aborted every scrape from mid-festival on. The protection it used to provide now comes
  from `MAX_UNEXPECTED_CANCELLED_SHOWS` - shows that vanished *with performances still
  ahead of them*, which a normal festival day never produces. Same reasoning for the
  `returned no showtimes` guard: a show can sit on the board with an empty `eventTimes`
  after its last performance, so it's exempt when every slot already known is past.
- **A show the artist cancelled emits zero showtimes - never synthetic ones.** Upstream
  marks a cancellation only by prefixing the pin board title (`CANCELLED: All Below`);
  the card, the ticket page and the embed API all carry on as before.
  `isCancelledTitle` (`scraper/lib/util.mjs`) reads that prefix and `scrape.mjs` then
  skips `resolveTimes` entirely, emitting `times: []` so the merge cancels everything it
  already knows. Don't "fix" that by letting `resolveTimes` run: cancellation always
  coincides with sales ending, which drops `eventTimes` and sends the show down the
  date-wise fallback, and that path mints fresh `s{showId}-{start}` ids for the defunct
  slots - which the merge writes out as brand-new **active** showtimes that then render
  in the Grid as bookable. That's the exact bug this rule exists to prevent; it shipped
  once. Such a show carries `cancelled: true` while its `status` stays `active`, because
  `status` only tracks whether upstream still lists the show at all. Front-end side: the
  show stays in the Cards browser and the Shows filter for posterity, so `visible()`
  (`src/lib/derived.ts`) returns early for it - having no active perfs, it has no dates,
  and the Day/Time gate could never pass - while Venue/Rating/Warnings/exclusion/search
  still apply. `CardGrid` sorts it last, `ShowCard` drops the day rail, times toggle and
  pills, and `DetailPanel` shows `CANCELLED` for TIME with no pick button.
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
  `SyncSheet`, `MyFringePanel` and `DayStrip` each separately did, to signal a
  dimmed/disabled/outside-filter row - blends both the text and its background toward whatever's
  behind the element, which silently drops the *effective* contrast well below the
  token's own passing value (as low as 2.5:1 in one case, on a token that's 5:1+ on
  paper). An accessibility scanner catches this; `npm test`/`tsc`/lint don't, since
  the raw color values never change. If a row needs to look de-emphasized, change its
  `color` (there's usually already a token for it, e.g. `--text-mute`) instead of
  reducing the whole element's opacity. `DayStrip` was the last holdout and the only
  one axe actually caught in the act (serious color-contrast, 3 nodes, on every day tab
  switched off in the Day filter) - it dimmed with an inline `style={{ opacity: 0.5 }}`
  rather than a class, so it read as geometry rather than as a colour decision.
  `.day-strip__tab--dimmed` steps the date number from `--cream` to `--text-mute`
  instead. Note which token: `--text-ghost` is dimmer and would look better, but at
  3.2:1 it only clears the bar for *disabled* content (an empty day-rail cell), and a
  dimmed day tab is still clickable.
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
- **Upstream end times are sometimes plainly wrong, and duration is load-bearing.**
  Grid blocks are positioned by pixel math off `end - start`, so one bad value stretches
  a whole day's axis and paints a block across every other show on it. SimpleTix reports
  `dateEnd = dateStart + exactly 24h` for all four Late Night Cabaret nights (the show's
  own blurb says 11:00 PM to 1:00 AM), which rendered a 6720px block and a ~10,000px
  axis on Sep 3/4/10/11. There is no second source - the real length exists only as
  prose in the blurb - so the correction is curated in `scrape.mjs`'s
  `DURATION_OVERRIDES`, next to `SHORT_NAMES` and for the same reason. An override moves
  `end` only, never `timeId`, so it can't cancel-and-re-add a showtime and orphan a pick.
  `MAX_PLAUSIBLE_MINUTES` (360) warns about anything still too long after overrides;
  don't raise it to silence a warning, add the override.
- **A free show is signalled only by its pin board title**, exactly like a cancellation:
  `FREE - Late Night Cabaret (No Tickets Required, Just Show Up!)`. Nothing else upstream
  distinguishes it - not the embed API, not the ticket page's JSON-LD `offers`.
  `cleanShowTitle` (`scraper/lib/util.mjs`) strips the decoration into a usable title and
  returns `freeAdmission`, which `scrape.mjs` writes as a flag. **`ticketUrl` still
  slugifies the *raw* title** - the SimpleTix URL contains the full decoration. Front-end
  side the flag is `Show.freeAdmission` (never `free` - `PerfState` already uses that for
  an unclashing empty slot): `ShowCard` appends `· FREE` to the rating line,
  `DetailPanel` adds an ADMISSION row and relabels its footer link `Event page`,
  `MyFringePanel` says `Details ↗`, and `matchesQuery` matches "free" off the flag since
  the word is no longer in the title.
- **`FESTIVAL_FIRST_DAY` is Sep 2, not Sep 3.** Ticketed shows run Sep 3-13, but the
  festival's own free Sampler is on Sep 2. A performance on a day outside
  `festivalDayKeys()` has no column in the day strip, so `visible()` can never pass for
  it and the show vanishes from the app entirely - it was invisible until this was
  widened. The knock-on is that the grid lands on Sep 2, a one-show day, so any test
  that needs a fuller day has to select one (see `selectDay` in `GridPlanner.test.tsx`).
- **The show page's JSON-LD can be wrong for reasons that aren't timezones.** For the
  Sampler (291461) it says `2026-09-02T23:00:00+00:00` (= 20:00 Halifax) while the API
  *and the page's own rendered header* ("September 2, 2026 7:00 p.m.") both say 19:00.
  `mergePageTimes`' superset guard catches it and keeps the API's time, which is right -
  so that standing warning is expected, and its "Check whether the JSON-LD timezone
  changed" advice doesn't apply here.
- **No genre field.** Genre data isn't available on the festival website or in the PDF
  guide. Don't invent one - the front-end has no genre filter or genre-coded accents.
- **Don't commit the festival PDF** (it's gitignored - 32MB).

## Testing scraper changes

Verify with a real run, not by reasoning about the diff:

1. `npm run scrape` - expect 59 shows / 299 showtimes, exit 0. Neither count is stable
   any more now that the festival is running: the total grows whenever upstream cancels
   and re-issues a performance (retired entries are kept forever) and the active count
   falls every day as performances are played and retired to `ended`. Compare against the
   previous run, not against a number written down here.
2. Run it twice. The second run must print "No changes since the last run" and leave
   `src/data/show_times.json` byte-identical apart from `scrapedAt`. Churn on a clean re-run means
   the merge keying is broken.
3. To exercise cancel/reschedule/revive, back `src/data/show_times.json` up, mutate the copy in
   place, re-scrape, then **restore the good file**. Don't leave test mutations committed.
   This applies to mutating the *scraper* too: temporarily breaking `DURATION_OVERRIDES`
   to check the plausibility warning fires writes the round-trip into each affected
   showtime's `changes[]` history, which reverting the scraper does not undo. Restore the
   backup and re-scrape.
4. `scraper/lib/util.test.mjs` covers the pure helpers (`addMinutes`, `durationMinutes`,
   `cleanShowTitle`) and runs under the front-end's `npm test` - vitest's default include
   picks up `scraper/**`.

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
