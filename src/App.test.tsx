import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { AppProvider } from './state/AppContext';
import { shows } from './lib/loadData';
import { LABEL_WIDTH } from './components/GridPlanner/gridLayout';
import { FiltersOverflowModal, MoreFiltersButton } from './components/FilterBar/FiltersOverflowModal';

// The mobile Grid Planner reuses the same components as desktop (shared
// wordmark, grid blocks, badges, etc.), both rendered at once and toggled
// via a CSS media query - so tests about desktop-specific behavior need to
// scope their queries to the desktop tree, not the whole document.
function desktopEl(): HTMLElement {
  return document.querySelector('.grid-planner-responsive__desktop') as HTMLElement;
}

function desktop() {
  return within(desktopEl());
}

function mobileEl(): HTMLElement {
  return document.querySelector('.grid-planner-responsive__mobile') as HTMLElement;
}

function mobile() {
  return within(mobileEl());
}

describe('App (Grid Planner)', () => {
  it('renders without throwing and shows the wordmark', () => {
    render(<App />);
    expect(desktop().getByText('HALIFAX FRINGE')).toBeInTheDocument();
  });

  it('renders a day strip with 11 festival days', () => {
    render(<App />);
    expect(desktopEl().querySelectorAll('.day-strip__tab').length).toBe(11);
  });

  it('renders grid blocks for the selected day and toggling a pick updates the My Fringe counter', () => {
    render(<App />);
    const badgeBefore = desktop().getByText('0');
    expect(badgeBefore).toBeInTheDocument();

    const blocks = desktopEl().querySelectorAll('.grid-block');
    expect(blocks.length).toBeGreaterThan(0);

    fireEvent.click(blocks[0]);

    // Badge should now read 1
    expect(desktop().getByText('1')).toBeInTheDocument();
  });

  it('opens the detail panel when the info button is clicked, without also toggling the pick', () => {
    render(<App />);
    const infoButtons = desktop().getAllByRole('button', { name: /Details for/ });
    expect(infoButtons.length).toBeGreaterThan(0);

    fireEvent.click(infoButtons[0]);

    expect(document.querySelector('.detail-panel')).toBeInTheDocument();
    // stopPropagation means the pick count should still be 0
    expect(desktop().getByText('0')).toBeInTheDocument();
  });

  it('positions a 3:30pm show under the 3:30pm column, not shifted a slot late', () => {
    // Regression test: APPLES! as told by an expert has a real Sep 3 15:30-16:30
    // performance (it also runs at 18:30 the same day, hence matching on the
    // 3:30 PM meta text specifically). The grid's bounds are computed per day
    // (see next test) - Sep 3's earliest active performance is 14:00 (840 min):
    // left = (930-840)/30 * 140 + 4 = 424px, width = (60/30) * 140 - 8 = 272px.
    render(<App />);
    const blocks = desktop()
      .getAllByTitle('APPLES! as told by an expert')
      .map((el) => el.closest('.grid-block') as HTMLElement);
    const block = blocks.find((b) => b.textContent?.includes('3:30 PM'));
    expect(block).toBeDefined();
    expect(block!.style.left).toBe('424px');
    expect(block!.style.width).toBe('272px');
  });

  it('positions a show starting off the half-hour (7:45pm) proportionally, not defaulted to the first slot', () => {
    // Regression test: The Jackson Elementary... starts at 19:45, which isn't
    // a half-hour boundary. CSS grid-column line numbers must be integers, so
    // the old grid-column-based placement produced a fractional line, which is
    // invalid and made the browser silently auto-place the block into the
    // first cell. Pixel-based left/width handles any start time:
    // left = (1185-840)/30 * 140 + 4 = 1614px.
    render(<App />);
    const blocks = desktop()
      .getAllByTitle(/Jackson Elementary/)
      .map((el) => el.closest('.grid-block'))
      .filter((el): el is HTMLElement => el !== null);
    expect(blocks.length).toBe(1);
    expect(blocks[0].style.left).toBe('1614px');
  });

  it("trims the grid axis to the selected day's own performances, not the whole festival's range", () => {
    // Regression test: Sep 3's shows run 14:00-22:30. Before this fix, the
    // axis was computed once across every day in the festival (10:30am-10:30pm),
    // wasting most of the grid on hours nothing runs on any given night.
    render(<App />);
    const headerLabels = Array.from(desktopEl().querySelectorAll('.time-header__label')).map(
      (el) => el.textContent,
    );
    expect(headerLabels[0]).toBe('2:00 PM');
    expect(headerLabels).not.toContain('10:30 AM');
    expect(headerLabels).not.toContain('11:00 AM');
  });

  it('highlights a genuinely overlapping different-start-time show as a clash when picked', () => {
    // Reported bug: picking a show doesn't highlight an overlapping show that
    // starts at a *different* time as a conflict (same start time works).
    // Real pair on Sep 6: 'NÔRM(Ə)L' 19:30-20:15 genuinely overlaps
    // 'Craig in Conversation with God' 20:00-20:45 (20:00-20:15).
    render(<App />);

    const sep6Tab = Array.from(desktopEl().querySelectorAll('.day-strip__tab')).find(
      (el) => el.textContent?.includes('SUN') && el.textContent?.includes('6'),
    ) as HTMLElement;
    expect(sep6Tab).toBeDefined();
    fireEvent.click(sep6Tab);

    const normBlocks = desktop()
      .getAllByTitle('‘NÔRM(Ə)L')
      .map((el) => el.closest('.grid-block') as HTMLElement);
    const normBlock = normBlocks.find((b) => b.textContent?.includes('7:30 PM'));
    expect(normBlock).toBeDefined();
    fireEvent.click(normBlock!);

    const craigBlocks = desktop()
      .getAllByTitle('Craig in Conversation with God')
      .map((el) => el.closest('.grid-block') as HTMLElement);
    const craigBlock = craigBlocks.find((b) => b.textContent?.includes('8:00 PM'));
    expect(craigBlock).toBeDefined();
    expect(craigBlock!.className).toContain('grid-block--clash');
  });

  it("sizes a block's width proportionally to its actual duration, not a fixed minimum", () => {
    // Regression test: Peak Twins (Sep 3, 21:00-21:30, 30 min) used to render
    // at the same fixed-minimum width as a 60-min show, visually overlapping
    // Putt Putt Punishment (21:30-22:30) even though Peak Twins had already
    // ended when Putt Putt started - a false visual clash with no logical
    // clash. Width must scale with duration so adjacent-but-not-overlapping
    // shows don't visually overlap.
    render(<App />);

    const peakTwins = desktop()
      .getAllByTitle('Peak Twins')
      .map((el) => el.closest('.grid-block'))
      .filter((el): el is HTMLElement => el !== null);
    const puttPutt = desktop()
      .getAllByTitle('Putt Putt Punishment')
      .map((el) => el.closest('.grid-block'))
      .filter((el): el is HTMLElement => el !== null);
    expect(peakTwins.length).toBe(1);
    expect(puttPutt.length).toBe(1);

    const peakLeft = parseFloat(peakTwins[0].style.left);
    const peakWidth = parseFloat(peakTwins[0].style.width);
    const puttLeft = parseFloat(puttPutt[0].style.left);

    expect(peakLeft + peakWidth).toBeLessThanOrEqual(puttLeft);
  });

  it("folds the leading gutter into the sticky label's own box instead of the scroll container's padding", () => {
    // Regression test: padding on .grid-body__scroll doesn't clip content, so
    // a block scrolled to that position rendered visibly to the left of the
    // sticky venue label, in the gap the label's background didn't cover.
    // The rendered grid-template-columns (label width + 1fr) must match
    // LABEL_WIDTH on desktop, and the scroll container must have no left
    // padding of its own.
    render(<App />);
    expect(LABEL_WIDTH).toBe(176);

    const timeHeader = desktopEl().querySelector('.time-header') as HTMLElement;
    expect(timeHeader.style.gridTemplateColumns).toBe(`${LABEL_WIDTH}px 1fr`);

    const css = readFileSync(
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.css'),
      'utf8',
    );
    expect(css).toMatch(/\.grid-body__scroll\s*{[^}]*padding:\s*0 26px 0 0/);
  });

  it('sizes the time header and every venue row to the same explicit width, so borders span the full scrollable grid', () => {
    render(<App />);
    const timeHeader = desktopEl().querySelector('.time-header') as HTMLElement;
    const venueRows = Array.from(desktopEl().querySelectorAll('.venue-row')) as HTMLElement[];
    expect(venueRows.length).toBeGreaterThan(0);

    const headerWidth = timeHeader.style.width;
    expect(headerWidth).toMatch(/^\d+px$/);
    for (const row of venueRows) {
      expect(row.style.width).toBe(headerWidth);
    }
  });

  it('pins the time header to the top of the grid scroll area and bounds the app to the viewport', () => {
    // Only .grid-body__scroll should scroll vertically - the top bar, day
    // strip, filter bar, and time header all stay put, with the time header
    // specifically sticky at the top of the scroll area (the vertical
    // counterpart to the venue-label's horizontal sticky).
    const gridCss = readFileSync(
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.css'),
      'utf8',
    );
    expect(gridCss).toMatch(/\.time-header\s*{[^}]*position:\s*sticky;[^}]*top:\s*0;/);

    const globalCss = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
    expect(globalCss).toMatch(/html,\s*\n?\s*body,\s*\n?\s*#root\s*{[^}]*height:\s*100%/);
    expect(globalCss).toMatch(/body\s*{[^}]*overflow:\s*hidden/);
  });
});

describe('App (mobile Grid Planner)', () => {
  it('shows the app initials (not the selected date) alongside just the view toggle and My Fringe', () => {
    // Collapsed to "HF" (not the full "HALIFAX FRINGE") specifically so the
    // wordmark, view toggle and My Fringe all fit on the same line on a
    // phone. The Filters button that used to live here is gone - filters
    // live in the FilterBar row below, the same component desktop uses.
    render(<App />);
    expect(mobile().queryByText('HALIFAX FRINGE')).not.toBeInTheDocument();
    expect(mobile().getByText('HF')).toBeInTheDocument();

    const topbar = mobileEl().querySelector('.topbar') as HTMLElement;
    expect(within(topbar).queryByRole('button', { name: /^Filters/ })).not.toBeInTheDocument();
    expect(within(topbar).getByRole('button', { name: /My Fringe/ })).toBeInTheDocument();
  });

  it('hides per-day show counts on the day strip', () => {
    render(<App />);
    expect(mobile().queryAllByText(/shows$/).length).toBe(0);
  });

  // jsdom has no layout engine (offsetWidth/clientWidth are always 0), so
  // useOverflowFilters can never measure a real overflow here - it falls
  // back to "everything fits", which is also exactly the state that should
  // make More… disappear entirely. The reverse (More… appearing once real
  // content actually overflows a real viewport) is a layout behavior and
  // belongs to the Playwright pass instead (see CLAUDE.md).
  it('renders every filter inline with no More… button when nothing needs to collapse', () => {
    render(<App />);
    expect(mobile().queryByRole('button', { name: /^More/ })).not.toBeInTheDocument();
    for (const label of ['Venue', 'Shows', 'Time', 'Day', 'Age & content', 'Content']) {
      expect(mobile().getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
  });

  it('reuses the same grid blocks as desktop, including pick-toggle and the info button', () => {
    render(<App />);
    const blocks = mobileEl().querySelectorAll('.grid-block');
    expect(blocks.length).toBeGreaterThan(0);

    fireEvent.click(blocks[0]);
    expect(mobile().getByText('1')).toBeInTheDocument();

    const infoButtons = mobile().getAllByRole('button', { name: /Details for/ });
    fireEvent.click(infoButtons[0]);
    expect(document.querySelector('.detail-panel')).toBeInTheDocument();
  });

  it('uses a narrower venue column with no address line, clamped to 3 lines', () => {
    render(<App />);
    const label = mobileEl().querySelector('.venue-row__label') as HTMLElement;
    expect(label.className).toContain('venue-row__label--compact');
    expect(mobileEl().querySelector('.venue-row__address')).not.toBeInTheDocument();

    const timeHeader = mobileEl().querySelector('.time-header') as HTMLElement;
    expect(timeHeader.style.gridTemplateColumns).toMatch(/^\d+px 1fr$/);
    expect(timeHeader.style.gridTemplateColumns).not.toBe(`${LABEL_WIDTH}px 1fr`);

    const css = readFileSync(
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.css'),
      'utf8',
    );
    expect(css).toMatch(/\.venue-row__name--compact\s*{[^}]*-webkit-line-clamp:\s*3;/);
  });

  it('hides the grid legend on narrow phones (under ~520px)', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.css'),
      'utf8',
    );
    expect(css).toMatch(/@media \(max-width:\s*520px\)\s*{\s*\.grid-body__legend\s*{\s*display:\s*none;/);
  });
});

// The More… button's own click/open/close/tap-through wiring, tested
// directly rather than through the real FilterBar - whether More… is
// present at all in a given layout is a width-driven decision jsdom can't
// make (see the "no More… button when nothing needs to collapse" test
// above and the Playwright pass in CLAUDE.md), but once it exists, clicking
// it and interacting with the modal it opens has nothing to do with layout.
describe('FiltersOverflowModal', () => {
  function renderModal() {
    return render(
      <AppProvider>
        <MoreFiltersButton view="grid" />
        <FiltersOverflowModal view="grid" />
      </AppProvider>,
    );
  }

  it('opens from the More… button and lists every filter', () => {
    renderModal();
    expect(document.querySelector('.filters-overflow-overlay')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^More/ }));

    const overlay = document.querySelector('.filters-overflow-overlay');
    expect(overlay).toBeInTheDocument();
    for (const label of ['Day', 'Time', 'Venue', 'Age & content', 'Content', 'Conflicts', 'Shows']) {
      expect(within(overlay as HTMLElement).getByText(label)).toBeInTheDocument();
    }
  });

  it('stays open when a control inside it is tapped, and toggles that control', () => {
    // Real taps dispatch mousedown before click; FilterBar's own outside-click
    // listener (live at every width, since desktop and mobile are both always
    // mounted) used to unmount a sibling copy of this sheet on that mousedown,
    // before the tap ever reached the control inside it.
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));

    const overlay = () => document.querySelector('.filters-overflow-overlay') as HTMLElement;
    const dayRow = within(overlay()).getByText('Fri 4 Sep').closest('label') as HTMLElement;
    const checkbox = within(dayRow).getByRole('checkbox');
    expect(checkbox).toBeChecked();

    fireEvent.mouseDown(checkbox);
    expect(overlay()).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(overlay()).toBeInTheDocument();
    expect(
      within(within(overlay()).getByText('Fri 4 Sep').closest('label') as HTMLElement).getByRole('checkbox'),
    ).not.toBeChecked();
  });

  it('closes from its own backdrop', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));
    expect(document.querySelector('.filters-overflow-overlay')).toBeInTheDocument();

    fireEvent.click(document.querySelector('.filters-overflow-backdrop')!);
    expect(document.querySelector('.filters-overflow-overlay')).not.toBeInTheDocument();
  });
});

function switchToCards() {
  fireEvent.click(desktop().getByRole('button', { name: 'Cards' }));
}

describe('App (Card Browser)', () => {
  it('switches from Grid to Cards via the shared top bar toggle, and back', () => {
    render(<App />);
    expect(document.querySelector('.card-browser')).not.toBeInTheDocument();
    expect(document.querySelector('.grid-planner')).toBeInTheDocument();

    switchToCards();
    expect(document.querySelector('.card-browser')).toBeInTheDocument();
    expect(document.querySelector('.grid-planner')).not.toBeInTheDocument();

    fireEvent.click(within(document.querySelector('.card-browser') as HTMLElement).getByRole('button', { name: 'Grid' }));
    expect(document.querySelector('.grid-planner')).toBeInTheDocument();
  });

  it('reuses the same FilterBar and TopBar components as Grid Planner', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('.card-browser') as HTMLElement);
    expect(browser.getByText('FILTER')).toBeInTheDocument(); // FilterBar label
    expect(browser.getByText('HALIFAX FRINGE')).toBeInTheDocument(); // TopBar wordmark
  });

  it('omits the search field and starting-soon band from the original mockup', () => {
    render(<App />);
    switchToCards();
    const browser = document.querySelector('.card-browser') as HTMLElement;
    expect(browser.querySelector('.starting-soon')).not.toBeInTheDocument();
    expect(within(browser).queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("star button toggles all of a show's in-filter performances at once", () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('.card-browser') as HTMLElement);

    // Peak Twins has exactly one performance on each of 6 days.
    const card = browser.getByText('Peak Twins').closest('.show-card') as HTMLElement;
    const star = within(card).getByRole('button', { name: /Add all of Peak Twins/ });

    fireEvent.click(star);
    expect(browser.getByText('6 PICKED')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /Remove Peak Twins/ }));
    expect(browser.getByText('0 PICKED')).toBeInTheDocument();
  });

  it('clicking a day-rail cell with a single performance toggles it directly', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('.card-browser') as HTMLElement);

    const card = browser.getByText('Peak Twins').closest('.show-card') as HTMLElement;
    const sep3Cell = within(card)
      .getAllByRole('button')
      .find((b) => b.className.includes('day-rail__cell') && b.getAttribute('aria-label')?.includes('Thu 3'));
    expect(sep3Cell).toBeDefined();

    fireEvent.click(sep3Cell!);
    expect(browser.getByText('1 PICKED')).toBeInTheDocument();
    expect(sep3Cell!.className).toContain('day-rail__cell--picked');
  });

  it('clicking a day-rail cell with multiple performances expands the time pill list instead of picking', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('.card-browser') as HTMLElement);

    // APPLES! as told by an expert has two performances on Sep 3 (3:30pm, 6:30pm).
    const card = browser.getByText('APPLES! as told by an expert').closest('.show-card') as HTMLElement;
    expect(within(card).queryByText(/PM$/)).not.toBeInTheDocument(); // not expanded yet

    const sep3Cell = within(card)
      .getAllByRole('button')
      .find((b) => b.className.includes('day-rail__cell') && b.getAttribute('aria-label')?.includes('Thu 3'));
    expect(sep3Cell!.textContent).toContain('×2');

    fireEvent.click(sep3Cell!);
    // Expanding shouldn't pick anything, but should reveal the time pills.
    expect(browser.getByText('0 PICKED')).toBeInTheDocument();
    expect(within(card).getByText('HIDE TIMES ▲')).toBeInTheDocument();
    expect(within(card).getAllByRole('button', { name: /THU 3/ }).length).toBe(2);
  });

  it('SHOW TIMES expands the time pill list, and clicking a pill toggles that one performance', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('.card-browser') as HTMLElement);

    const card = browser.getByText('APPLES! as told by an expert').closest('.show-card') as HTMLElement;
    fireEvent.click(within(card).getByText('SHOW TIMES ▼'));
    expect(within(card).getByText('HIDE TIMES ▲')).toBeInTheDocument();

    const pills = within(card).getAllByRole('button', { name: /THU 3/ });
    expect(pills.length).toBe(2);

    fireEvent.click(pills[0]);
    expect(browser.getByText('1 PICKED')).toBeInTheDocument();
  });

  it('lists picks grouped by day in the My Fringe rail, with a working remove button', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('.card-browser') as HTMLElement);

    const card = browser.getByText('Peak Twins').closest('.show-card') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Add all of Peak Twins/ }));

    const rail = document.querySelector('.my-fringe-rail') as HTMLElement;
    expect(rail).toBeInTheDocument();
    const railScope = within(rail);
    expect(railScope.getByText('6 PICKED')).toBeInTheDocument();
    expect(railScope.getAllByText('Peak Twins').length).toBe(6);

    fireEvent.click(railScope.getAllByRole('button', { name: /Remove Peak Twins/ })[0]);
    expect(railScope.getByText('5 PICKED')).toBeInTheDocument();
  });
});

describe('Day / Time filters gate which shows are browsable', () => {
  // Idempotent - the Day button toggles, and openMenu persists across a
  // view switch, so blindly clicking it can close an already-open menu.
  function openDayMenu() {
    if (!document.querySelector('.dropdown')) {
      const browser = within(document.querySelector('.card-browser') as HTMLElement);
      fireEvent.click(browser.getByRole('button', { name: /^Day/ }));
    }
    return within(document.querySelector('.dropdown') as HTMLElement);
  }

  // Both desktop and mobile trees render simultaneously (CSS media query
  // picks which is visible). The desktop tree has `.card-browser`; the
  // mobile tree has `.card-browser-mobile` — scope to desktop.
  const cardBrowserEl = () => document.querySelector('.card-browser') as HTMLElement;
  const cardCount = () => cardBrowserEl().querySelectorAll('.show-card').length;

  it('shows no cards at all when every day is deselected', () => {
    // Reported bug: clearing the day filter left every card on screen,
    // because visible() only consulted excluded/venue/rating/clash and never
    // the day or time filter - so Day and Time had no effect on the grid.
    render(<App />);
    switchToCards();
    expect(cardCount()).toBe(56);

    fireEvent.click(openDayMenu().getByRole('button', { name: /Clear/ }));

    expect(cardCount()).toBe(0);
    expect(
      within(document.querySelector('.card-browser') as HTMLElement).getByText(
        /No shows match the current filters/,
      ),
    ).toBeInTheDocument();
  });

  it('narrows cards to only shows playing on the selected day', () => {
    render(<App />);
    switchToCards();

    // Clear, then re-enable a single day.
    fireEvent.click(openDayMenu().getByRole('button', { name: /Clear/ }));
    fireEvent.click(within(document.querySelector('.dropdown') as HTMLElement).getByText('Thu 3 Sep'));

    const expected = shows.filter((s) =>
      s.perfs.some((p) => p.status === 'active' && p.day === '2026-09-03'),
    ).length;

    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(shows.length); // otherwise the test proves nothing
    expect(cardCount()).toBe(expected);
  });

  it('keeps picks that fall outside the day filter, dimmed rather than dropped', () => {
    // Filters change what you're browsing, never what you've committed to.
    render(<App />);
    switchToCards();

    const browser = within(document.querySelector('.card-browser') as HTMLElement);
    const card = browser.getByText('Peak Twins').closest('.show-card') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Add all of Peak Twins/ }));
    expect(browser.getByText('6 PICKED')).toBeInTheDocument();

    fireEvent.click(openDayMenu().getByRole('button', { name: /Clear/ }));

    // No cards browsable, but the schedule is untouched.
    expect(cardCount()).toBe(0);
    const rail = within(document.querySelector('.my-fringe-rail') as HTMLElement);
    expect(rail.getByText('6 PICKED')).toBeInTheDocument();
    expect(document.querySelectorAll('.my-fringe-rail__row--outside').length).toBe(6);
  });

  it('clicking a grid day tab enables that day without switching the others off', () => {
    // SET_GRID_DAY used to narrow daysOn to only the clicked day. Now that
    // the date filter actually gates what's browsable, that silently
    // destroyed a multi-day filter as soon as you clicked through days in
    // the grid - e.g. set a Fri+Sat+Sun filter, browse the grid, come back
    // to Cards and only Sunday is left.
    render(<App />);

    // Narrow to two days in the Card Browser first.
    switchToCards();
    fireEvent.click(openDayMenu().getByRole('button', { name: /Clear/ }));
    const menu = () => within(document.querySelector('.dropdown') as HTMLElement);
    fireEvent.click(menu().getByText('Thu 3 Sep'));
    fireEvent.click(menu().getByText('Fri 4 Sep'));
    const twoDayCount = cardCount();
    expect(twoDayCount).toBeGreaterThan(0);

    // Go to the grid and click a third day's tab.
    fireEvent.click(within(document.querySelector('.card-browser') as HTMLElement).getByRole('button', { name: 'Grid' }));
    const sep5Tab = Array.from(desktopEl().querySelectorAll('.day-strip__tab')).find(
      (el) => el.textContent?.includes('SAT') && el.textContent?.includes('5'),
    ) as HTMLElement;
    fireEvent.click(sep5Tab);

    // Back in Cards, the original two days must still be on - now three.
    fireEvent.click(desktop().getByRole('button', { name: 'Cards' }));
    const dayMenu = openDayMenu();
    for (const label of ['Thu 3 Sep', 'Fri 4 Sep', 'Sat 5 Sep']) {
      const row = dayMenu.getByText(label).closest('label') as HTMLElement;
      expect(within(row).getByRole('checkbox')).toBeChecked();
    }
    expect(cardCount()).toBeGreaterThan(twoDayCount);
  });
});

// Comfortably past the 250ms debounce persistence.ts writes the URL on.
const DEBOUNCE_SETTLE_MS = 400;

describe('Sync Sheet', () => {
  function openSync() {
    // Button text is "My Fringe" plus a nested <span> badge, so the
    // accessible name includes the number. Matching by the visible text
    // prefix gets the button regardless of the count.
    const btn = desktopEl().querySelector('.topbar__myfringe') as HTMLElement;
    fireEvent.click(btn);
  }

  function syncScope() {
    return within(document.querySelector('.sync-sheet') as HTMLElement);
  }

  it('opens from the My Fringe button, displays the real URL hash after picking', () => {
    render(<App />);
    expect(document.querySelector('.sync-sheet')).not.toBeInTheDocument();

    openSync();
    expect(document.querySelector('.sync-sheet')).toBeInTheDocument();
    expect(syncScope().getByText('TAKE IT WITH YOU')).toBeInTheDocument();

    // URL box contains the hash prefix even with an empty schedule.
    const urlBox = document.querySelector('.sync-link-row__url');
    expect(urlBox?.textContent).toContain('#p=');
  });

  it('shows the schedule summary matching the current state', () => {
    render(<App />);
    const blocks = desktopEl().querySelectorAll('.grid-block');
    fireEvent.click(blocks[0]);
    fireEvent.click(blocks[1]);

    openSync();
    expect(syncScope().getByText(/2 PERFORMANCE/)).toBeInTheDocument();
  });

  it('can be dismissed by clicking the backdrop or close button', () => {
    render(<App />);
    openSync();
    expect(document.querySelector('.sync-sheet')).toBeInTheDocument();

    fireEvent.click(document.querySelector('.sync-backdrop')!);
    expect(document.querySelector('.sync-sheet')).not.toBeInTheDocument();

    openSync();
    fireEvent.click(syncScope().getByRole('button', { name: 'Close sync' }));
    expect(document.querySelector('.sync-sheet')).not.toBeInTheDocument();
  });

  it('renders the .ics, .json download and restore rows', () => {
    render(<App />);
    openSync();
    expect(syncScope().getByText('.ICS')).toBeInTheDocument();
    expect(syncScope().getByText('.JSON')).toBeInTheDocument();
    expect(syncScope().getByPlaceholderText(/Restore from/)).toBeInTheDocument();
  });

  // The restore row used to hand the pasted text straight to decodePicked,
  // which takes only the bare token string - so pasting the very link the
  // sheet had just produced always answered "No valid picks found".
  it('restores the schedule from a link pasted into the restore row', () => {
    render(<App />);
    const blocks = desktopEl().querySelectorAll('.grid-block');
    fireEvent.click(blocks[0]);
    fireEvent.click(blocks[1]);

    openSync();
    // Exactly the string the sheet offers for copying.
    const link = document.querySelector('.sync-link-row__url')!.textContent as string;
    expect(link).toMatch(/#p=.+/);

    // Clear the schedule, then paste the link back in.
    fireEvent.click(syncScope().getByRole('button', { name: 'Close sync' }));
    fireEvent.click(desktopEl().querySelectorAll('.grid-block')[0]);
    fireEvent.click(desktopEl().querySelectorAll('.grid-block')[1]);
    openSync();
    expect(syncScope().getByText(/^0 PERFORMANCE/)).toBeInTheDocument();

    const input = syncScope().getByPlaceholderText(/Restore from/);
    fireEvent.paste(input, { clipboardData: { getData: () => link } });

    expect(syncScope().getByText('Restored 2 performances.')).toBeInTheDocument();
    expect(syncScope().getByText(/^2 PERFORMANCE/)).toBeInTheDocument();
  });

  // Picks are written with replaceState, which never fires popstate. The old
  // guard set a flag before each of those writes and cleared it in the
  // popstate handler, so the flag was still set when the first genuine Back
  // arrived and that navigation was ignored: the address bar changed and the
  // schedule on screen didn't.
  it('applies the hash from a genuine Back navigation', async () => {
    render(<App />);
    const blocks = () => desktopEl().querySelectorAll('.grid-block');

    fireEvent.click(blocks()[0]);
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    const onePickHash = window.location.hash;
    expect(onePickHash).toMatch(/#p=.+/);

    fireEvent.click(blocks()[1]);
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    expect(window.location.hash).not.toBe(onePickHash);
    expect(desktop().getByText('2')).toBeInTheDocument();

    // What the browser does on Back: the URL is already the earlier one by
    // the time the event fires.
    window.history.replaceState(null, '', onePickHash);
    fireEvent.popState(window);

    expect(desktop().getByText('1')).toBeInTheDocument();
  });

  it('reports unusable restore input instead of silently doing nothing', () => {
    render(<App />);
    openSync();
    const input = syncScope().getByPlaceholderText(/Restore from/);
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://example.test/not-a-schedule' } });
    expect(syncScope().getByText('No valid picks found in that link or file.')).toBeInTheDocument();
  });
});
