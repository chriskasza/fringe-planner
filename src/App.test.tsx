import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { shows } from './lib/loadData';
import { LABEL_WIDTH } from './components/GridPlanner/gridLayout';

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
    expect(desktop().getAllByText(/shows$/).length).toBe(11);
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
  it('shows the app initials (not the selected date) alongside Filters and My Fringe on one row', () => {
    // Collapsed to "HF" (not the full "HALIFAX FRINGE") specifically so
    // title + Filters + My Fringe all fit on the same line on a phone.
    render(<App />);
    expect(mobile().queryByText('HALIFAX FRINGE')).not.toBeInTheDocument();
    expect(mobile().getByText('HF')).toBeInTheDocument();

    const topbar = mobileEl().querySelector('.topbar') as HTMLElement;
    expect(within(topbar).getByRole('button', { name: /^Filters/ })).toBeInTheDocument();
    expect(within(topbar).getByRole('button', { name: /My Fringe/ })).toBeInTheDocument();
  });

  it('hides per-day show counts on the day strip', () => {
    render(<App />);
    expect(mobile().queryAllByText(/shows$/).length).toBe(0);
  });

  it('opens the consolidated filters panel from a single Filters button', () => {
    render(<App />);
    expect(document.querySelector('.mobile-filters-overlay')).not.toBeInTheDocument();

    fireEvent.click(mobile().getByRole('button', { name: /^Filters/ }));

    const overlay = document.querySelector('.mobile-filters-overlay');
    expect(overlay).toBeInTheDocument();
    // All six filter sections should be present in one panel.
    for (const label of ['Day', 'Time', 'Venue', 'Age & content', 'Clashes', 'Shows']) {
      expect(within(overlay as HTMLElement).getByText(label)).toBeInTheDocument();
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
  function openDayMenu() {
    const browser = within(document.querySelector('.card-browser') as HTMLElement);
    fireEvent.click(browser.getByRole('button', { name: /^Day/ }));
    return within(document.querySelector('.dropdown') as HTMLElement);
  }

  const cardCount = () => document.querySelectorAll('.show-card').length;

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
});
