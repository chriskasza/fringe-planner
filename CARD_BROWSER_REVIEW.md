# Card Browser UI review

Reviewed by rendering the running app in headless Chromium (Playwright) at
1440px, 1000px and 390px, capturing screenshots and running hit-tests /
geometry dumps against the live DOM. Findings below are observed, not
inferred from reading CSS.

## Fixed in this pass

### 1. Every card overlapped the cards below it (critical)

**Symptom:** No card content was visible at all — just three vertical columns
of striped image placeholders with star buttons repeating every ~37px. Clicking
`SHOW TIMES` was impossible; Playwright reported
`<div class="show-card__image"> … intercepts pointer events`.

**Measured cause:** `.card-grid` computed `grid-template-rows` was
**19 implicit rows of 18.83px each**, while every card rendered ~324px tall.
Cards in one column sat at y=190, 227, 264, 301 — 37px apart but 324px tall,
so each overlapped the next by ~287px.

`.card-grid` is `flex: 1; min-height: 0` inside a bounded flex parent, which
gives it a **definite** height (732px). With implicit `auto` rows, the grid
track algorithm sized the rows to fit that definite height instead of to their
content. `.show-card`'s `overflow: hidden` makes its min-content height ~0, so
the rows were free to collapse arbitrarily.

**Fix:** `grid-auto-rows: max-content` + `align-content: start` on `.card-grid`,
so rows size to content and leftover space isn't redistributed into the tracks.
Overflow then scrolls via the existing `overflow-y: auto`. Rows now measure
324–417px and cards are 342px apart with no overlap.

### 2. My Fringe rail footer painted over the picked-shows list

**Symptom:** With ~17 picks, `GET TICKETS · 17` and `SYNC TO ANOTHER DEVICE`
rendered on top of the day groups — rail rows showed through the buttons.

**Cause:** `.my-fringe-rail` owned `overflow-y: auto` while
`.my-fringe-rail__body` had `flex: 1; min-height: 0` and no overflow of its
own. The body shrank below its content, and the content spilled out of the
body's box over the `margin-top: auto` footer.

**Fix:** Moved scrolling to the body (`overflow-y: auto`) and set the rail
itself to `overflow: hidden`, giving the intended fixed-header / scrolling-body
/ fixed-footer structure.

## Verified working

- Card content, day rail states (picked gold, clash coral, outside-filter
  dashed), and `N PERFORMANCES · N PICKED` summaries all render correctly and
  match the underlying data.
- `SHOW TIMES` expands in place; time pills list the show's real performances;
  neighbours in the row stay top-aligned (`align-items: start` behaving).
- Filter dropdowns layer correctly above the card grid — no clipping or
  z-index problems.
- My Fringe rail groups picks by day with correct `N OVERLAP` / `CLEAR` badges
  and coral edges on overlapping rows.
- 1000px correctly collapses to 2 columns.
- No console/page errors in any state.

## Since fixed (mobile treatment)

### Card Browser now has mobile and intermediate breakpoints

At 390px the layout was previously unusable: the 300px rail left ~90px for
cards (one letter per line); the desktop TopBar wrapped to multiple lines;
the desktop FilterBar ate four rows of the viewport. Now:

- Responsive wrapper mirrors GridPlanner — desktop tree (`.card-browser`) at
  >=700px, mobile tree (`.card-browser-mobile`) below.
- Mobile: compact TopBar (collapsed "HF" wordmark) + Cards/Grid switch +
  Filters button + My Fringe button on one row; single `CardGrid` column
  with no rail (the 300px rail is hidden); consolidated `MobileFiltersButton`
  / `MobileFiltersPanel` instead of the desktop FilterBar.
- Desktop intermediate (700-1000px): the 300px rail hides to free card-grid
  space, per the handoff's "rail becomes a bottom sheet under ~1000px" note.

All mobile pieces (compact TopBar, mobile filters panel) already existed from
the Grid Planner pass — they just needed wiring up.

## Since fixed (filter inconsistency pass)

### Day/Time filters had no effect on which shows were browsable (critical)

`visible()` checked excluded/venue/rating/clash but never `daysOn` or
`timeBucketsOn`. The Day and Time filter buttons only drove secondary things
(rail dimming, which time pills a card lists). Clearing every day still
showed all 56 cards. Fixed: a show is now visible only if it still has at
least one active performance inside the day/time filter.

### SET_GRID_DAY rewrote the shared date filter

Clicking a day tab in the grid narrowed `daysOn` to only that day. Harmless
while the date filter didn't gate anything, but after fixing the above it
silently destroyed a multi-day filter when you switched back to Cards.
Changed to additive — the clicked day is switched on, others left alone.

### Blank venue row in the Venue filter

The Venue dropdown had a blank row with count 1 — *Game of drones… Drummers
Are Coming* has no `venue` in the API. `scrape_meta.mjs` now recovers the
name from the show page's own JSON-LD (\"Outdoors – Different Locations\")
and `transform.ts` falls back to it. Verified in-browser: zero blank rows.

### Three summary grammars on filter buttons

Day/Time used one pattern (named singles), Venue/Age another (bare count),
Shows a third (ratio). Unified on ALL n / NONE / n OF m via
`summarizeSelected`, with Day/Time keeping the named-single edge case.

### Time filter buckets were invented, not derived

Four guessed buckets mislabelled the festival — "MORNING" held 5 of 282
performances, and "LATE NIGHT" started at 8pm (the busiest slot). Refitted
to the real clusters: MATINEE 71 / EVENING 100 / NIGHT 111 at 5pm/8pm
boundaries, with per-bucket counts.

### Search counted as an active filter

`activeFilterCount` counted `query` as an active filter, including the
search box inside the Shows panel. That doesn't filter the grid, so the
mobile badge claimed a filter was active while nothing on screen changed.

