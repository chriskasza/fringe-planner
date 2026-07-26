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

## Outstanding — not yet fixed

### 3. Card Browser has no mobile treatment (high)

At 390px the layout is unusable:

- The 300px `.my-fringe-rail` is still `flex: none`, leaving the card grid
  ~90px wide — titles wrap to one letter per line.
- It renders the **desktop** `TopBar` (wordmark wraps to two lines, tagline to
  three, `ON NOW` pill shown) instead of the `compact` variant the Grid
  Planner uses.
- It renders the **desktop** `FilterBar`, which wraps to four rows and eats
  most of the viewport, instead of the consolidated `MobileFiltersButton` /
  `MobileFiltersPanel` already built for the Grid Planner.
- The day rail's 11 columns overlap themselves at that width (a cell's centre
  hit-tests to a *different* cell's numeral).

Per the design handoff the rail should become a bottom sheet under ~1000px.
The mobile pieces (`compact` TopBar, mobile filters panel) already exist and
just need wiring up, mirroring `GridPlannerMobile`.

### 4. Blank venue row in the Venue filter (low)

The Venue dropdown's first row has an empty label with count 1 — that's
*Game of drones… Drummers Are Coming*, whose `venue` is an empty string
upstream (its page says "Outdoors – Different Locations"). It should render a
placeholder label rather than a blank checkbox row.

### 5. Card Browser is not vertically contained like Grid Planner (low)

`.card-browser` follows the same height chain, but unlike the Grid Planner
its `TopBar`/`FilterBar` aren't verified against the fixed-viewport shell at
small heights. Worth re-checking once the mobile work lands.
