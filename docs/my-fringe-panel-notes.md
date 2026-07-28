# My Fringe panel rework — findings for a future session

This captures what was learned while scoping the desktop/mobile merge (see
CLAUDE.md) so the My Fringe panel rework doesn't need to re-explore the
codebase from scratch. Nothing in this doc has been implemented yet.

## What the user wants (already decided, not open questions)

- The My Fringe panel should be collapsible/viewable on demand: not shown by
  default, opened by clicking the "My Fringe" button in `TopBar`, closed via
  an X in its own top-right corner.
- Picking a showtime (in either view) should open the panel, showing the
  newly added show.
- The panel should be reachable from **both** Cards and Grid view, not just
  Cards — and, per the desktop/mobile merge that already landed, from every
  viewport width, not just wide desktop screens.
- Clicking "My Fringe" in `TopBar` should open this panel, not the
  `SyncSheet` ("Take It With You") modal.
- No separate "Export" button is needed: the panel's own "Sync to another
  device" button remains the only entry point into `SyncSheet`.

## Current state (as of the desktop/mobile merge)

- `MyFringeRail` (`src/components/CardBrowser/MyFringeRail.tsx`) is
  desktop-Cards-only: it's mounted once, inside `CardBrowser.tsx`, wrapped in
  `.card-browser__rail`. CSS hides that wrapper at `max-width: 1000px`
  (`CardBrowser.module.css`) — there's **no reopen affordance** between
  700–1000px despite an old CSS comment claiming a toggle exists there; that
  comment was already stale before this doc was written.
- It is never rendered in Grid view at all (`GridPlanner.tsx` has no
  `MyFringeRail`).
- It has no props — it pulls everything from `useApp()` and has no
  open/closed concept. It's always in the DOM whenever `CardBrowser` renders;
  visibility is CSS-only.
- `AppState` (`src/lib/state.ts`) has no field for "panel open" and no
  "just picked" tracking. Nothing like a `myFringeOpen` boolean or a
  `lastPickedKey` exists today.
- `TopBar`'s My Fringe button (`src/components/PageHeader/TopBar.tsx`)
  currently dispatches `{ type: 'SET_SYNC_OPEN', open: true }` — it opens
  `SyncSheet` directly. There is no "open picks panel" action to dispatch
  instead; one will need to be added (e.g. `SET_MY_FRINGE_OPEN`) alongside a
  new `myFringeOpen: boolean` state field, following the exact pattern
  `syncOpen`/`SET_SYNC_OPEN` already establishes in `state.ts`.
- `SyncSheet` (`src/components/SyncSheet/SyncSheet.tsx`) is mounted once in
  `App.tsx`, as a sibling of whichever view is active, and renders `null`
  when `!state.syncOpen`. `MyFringeRail`'s own footer already has a "SYNC TO
  ANOTHER DEVICE ↗" button that dispatches `SET_SYNC_OPEN` — this is the
  button that should remain the sole path into `SyncSheet` once `TopBar`'s
  button is repointed at the new panel instead.

## Where picks happen (all dispatch sites, for wiring auto-open)

Every one of these ultimately calls the shared `appReducer` in
`src/lib/state.ts`, so adding "just added a pick → open the panel" logic at
the reducer level (inside the `TOGGLE_PICK`/`TOGGLE_SHOW_STAR` cases) covers
all of them without touching each call site:

- `ShowCard.tsx` — the ★ button dispatches `TOGGLE_SHOW_STAR` for the whole
  show (all in-filter performances at once).
- `DayRail.tsx` — a day cell with exactly one performance dispatches
  `TOGGLE_PICK` directly; a cell with multiple performances expands
  `TimePills` instead.
- `TimePills.tsx` — each expanded time pill dispatches `TOGGLE_PICK` for
  that exact performance.
- `GridBlock.tsx` — clicking a grid block dispatches `TOGGLE_PICK`; the
  nested ⓘ button dispatches `SET_DETAIL` instead (opens `DetailPanel`, does
  not pick).
- `DetailPanel.tsx` — the "★ Add to My Fringe" footer button and each
  "other performance" row both dispatch `TOGGLE_PICK`.
- `MyFringeRail.tsx` — the ✕ remove button on each row also dispatches
  `TOGGLE_PICK` (to un-pick); this should NOT re-trigger auto-open.

`TOGGLE_PICK`/`TOGGLE_SHOW_STAR` both add and remove depending on prior
state (they're toggles), so the reducer needs to distinguish "this action
added a key" from "this action removed a key" to only auto-open (and, if
implemented, highlight) on addition — see the reducer code for the exact
`toggleSet`/`anyPicked` logic already there to build on.

## Suggested integration shape (not decided, just a starting point)

- Add `myFringeOpen: boolean` (default `false`) to `AppState`, plus a
  `SET_MY_FRINGE_OPEN` action mirroring `SET_SYNC_OPEN`.
- In the `TOGGLE_PICK` and `TOGGLE_SHOW_STAR` reducer cases, set
  `myFringeOpen: true` only on the branch that adds a key, leaving it
  untouched on the branch that removes one (so un-picking from anywhere,
  including the panel's own ✕ button, doesn't force it open or closed).
- Repoint `TopBar`'s My Fringe button at `SET_MY_FRINGE_OPEN: true` instead
  of `SET_SYNC_OPEN`.
- Turn `MyFringeRail` into an overlay panel (rename to something like
  `MyFringePanel` if that reads better once it's no longer an inline rail):
  give it an X close button dispatching `SET_MY_FRINGE_OPEN: false`, gate its
  render on `state.myFringeOpen` (`if (!state.myFringeOpen) return null`,
  same pattern as `SyncSheet`), and mount it once in `App.tsx` alongside
  `SyncSheet` rather than inside `CardBrowser` only — that's what makes it
  reachable from Grid view and at every width without duplicating it per
  view. `DetailPanel` is a reasonable precedent for a panel that already
  works this way at every viewport (CSS-only side-panel-vs-overlay switch,
  no separate mobile version) if a similar responsive treatment is wanted
  here.
- Once `MyFringeRail` is no longer embedded inline in `CardBrowser`'s flex
  layout, `CardBrowser.tsx`'s `.card-browser__content` / `.card-browser__rail`
  wrapper divs and the 1000px rail-hide CSS in `CardBrowser.module.css`
  likely become dead code worth removing as part of this work.
