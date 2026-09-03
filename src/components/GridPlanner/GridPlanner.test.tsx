import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { shows } from '../../lib/loadData';

// The day strip opens on the first upcoming day that has shows, which is now
// Sep 2 (the free Halifax Fringe Sampler). Tests that assert against a
// particular day's data have to pick that day rather than assume the default.
function selectDay(dow: string, dateNum: number) {
  const tab = Array.from(document.querySelectorAll('[data-testid="day-strip-tab"]')).find(
    (el) => el.textContent?.includes(dow) && el.textContent?.includes(String(dateNum)),
  ) as HTMLElement;
  expect(tab).toBeDefined();
  fireEvent.click(tab);
}

describe('App (Grid Planner)', () => {
  it('renders without throwing and shows the wordmark', () => {
    render(<App />);
    expect(document.querySelector('[data-testid="topbar-wordmark"]')?.textContent).toBe('Halifax Fringe Planner');
  });

  // A cancelled show keeps its entry in the Cards browser for posterity, but
  // there is nothing to plan around it, so it must never place a block. Its
  // showtimes are all `cancelled`, which GridBody and gridTimeBounds already
  // filter on - this pins that they keep doing so.
  it('never places a block for a cancelled show, on any day', () => {
    render(<App />);

    const cancelled = shows.filter((s) => s.cancelled);
    expect(cancelled.length).toBeGreaterThan(0);

    for (const tab of Array.from(document.querySelectorAll('[data-testid="day-strip-tab"]'))) {
      fireEvent.click(tab as HTMLElement);
      for (const show of cancelled) {
        expect(screen.queryAllByTitle(show.title)).toEqual([]);
      }
    }
  });

  // A day with no active performances left is dropped from the strip, so the
  // tab count tracks the data rather than the festival's 12-day span.
  it('renders one day-strip tab per day that still has an active performance', () => {
    const liveDays = new Set(
      shows.flatMap((s) => s.perfs.filter((p) => p.status === 'active').map((p) => p.day)),
    );
    expect(liveDays.size).toBeGreaterThan(0);
    render(<App />);
    expect(document.querySelectorAll('[data-testid="day-strip-tab"]').length).toBe(liveDays.size);
  });

  it('renders grid blocks for the selected day and toggling a pick updates the My Fringe counter', () => {
    render(<App />);
    const badgeBefore = screen.getByText('0');
    expect(badgeBefore).toBeInTheDocument();

    const blocks = document.querySelectorAll('[data-testid="grid-block-pick"]');
    expect(blocks.length).toBeGreaterThan(0);

    fireEvent.click(blocks[0]);

    // Badge should now read 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('opens the detail panel when the info button is clicked, without also toggling the pick', () => {
    render(<App />);
    const infoButtons = screen.getAllByRole('button', { name: /Details for/ });
    expect(infoButtons.length).toBeGreaterThan(0);

    fireEvent.click(infoButtons[0]);

    expect(document.querySelector('[data-testid="detail-panel"]')).toBeInTheDocument();
    // stopPropagation means the pick count should still be 0
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('clicking the same block\'s info icon again closes the detail panel', () => {
    render(<App />);
    const infoButtons = screen.getAllByRole('button', { name: /Details for/ });

    fireEvent.click(infoButtons[0]);
    expect(document.querySelector('[data-testid="detail-panel"]')).toBeInTheDocument();

    fireEvent.click(infoButtons[0]);
    expect(document.querySelector('[data-testid="detail-panel"]')).not.toBeInTheDocument();
  });

  it('opening My Fringe closes an open detail panel, and vice versa', () => {
    render(<App />);
    const infoButtons = screen.getAllByRole('button', { name: /Details for/ });

    fireEvent.click(infoButtons[0]);
    expect(document.querySelector('[data-testid="detail-panel"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^My Fringe/ }));
    expect(document.querySelector('[data-testid="detail-panel"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid="my-fringe-panel"]')).toBeInTheDocument();

    fireEvent.click(infoButtons[0]);
    expect(document.querySelector('[data-testid="my-fringe-panel"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid="detail-panel"]')).toBeInTheDocument();
  });

  it('positions a 3:30pm show under the 3:30pm column, not shifted a slot late', () => {
    // Regression test: APPLES! as told by an expert has a real Sep 3 15:30-16:30
    // performance (it also runs at 18:30 the same day, hence matching on the
    // 3:30 PM meta text specifically). The grid's bounds are computed per day
    // (see next test) - Sep 3's earliest active performance is 14:00 (840 min):
    // left = (930-840)/30 * 140 + 4 = 424px, width = (60/30) * 140 - 8 = 272px.
    render(<App />);
    selectDay('THU', 3);
    const blocks = screen
      .getAllByTitle('APPLES! as told by an expert')
      .map((el) => el.closest('[data-testid="grid-block"]') as HTMLElement);
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
    selectDay('THU', 3);
    const blocks = screen
      .getAllByTitle(/Jackson Elementary/)
      .map((el) => el.closest('[data-testid="grid-block"]'))
      .filter((el): el is HTMLElement => el !== null);
    expect(blocks.length).toBe(1);
    expect(blocks[0].style.left).toBe('1614px');
  });

  it("trims the grid axis to the selected day's own performances, not the whole festival's range", () => {
    // Regression test: Sep 3's shows run 14:00-22:30. Before this fix, the
    // axis was computed once across every day in the festival (10:30am-10:30pm),
    // wasting most of the grid on hours nothing runs on any given night.
    render(<App />);
    selectDay('THU', 3);
    const headerLabels = Array.from(document.querySelectorAll('[data-testid="time-header-label"]')).map(
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

    selectDay('SUN', 6);

    const normBlocks = screen
      .getAllByTitle('‘NÔRM(Ə)L')
      .map((el) => el.closest('[data-testid="grid-block"]') as HTMLElement);
    const normBlock = normBlocks.find((b) => b.textContent?.includes('7:30 PM'));
    expect(normBlock).toBeDefined();
    fireEvent.click(normBlock!.querySelector('[data-testid="grid-block-pick"]')!);

    const craigBlocks = screen
      .getAllByTitle('Craig in Conversation with God')
      .map((el) => el.closest('[data-testid="grid-block"]') as HTMLElement);
    const craigBlock = craigBlocks.find((b) => b.textContent?.includes('8:00 PM'));
    expect(craigBlock).toBeDefined();
    // The aria-label already encodes clash state ("...Overlaps"), so assert
    // on the accessible name rather than the (now CSS-Modules-hashed) class.
    expect(craigBlock!.querySelector('[data-testid="grid-block-pick"]')!.getAttribute('aria-label')).toContain(
      'Overlaps',
    );
  });

  it("sizes a block's width proportionally to its actual duration, not a fixed minimum", () => {
    // Regression test: Peak Twins (Sep 3, 21:00-21:30, 30 min) used to render
    // at the same fixed-minimum width as a 60-min show, visually overlapping
    // Putt Putt Punishment (21:30-22:30) even though Peak Twins had already
    // ended when Putt Putt started - a false visual clash with no logical
    // clash. Width must scale with duration so adjacent-but-not-overlapping
    // shows don't visually overlap.
    render(<App />);
    selectDay('THU', 3);

    const peakTwins = screen
      .getAllByTitle('Peak Twins')
      .map((el) => el.closest('[data-testid="grid-block"]'))
      .filter((el): el is HTMLElement => el !== null);
    const puttPutt = screen
      .getAllByTitle('Putt Putt Punishment')
      .map((el) => el.closest('[data-testid="grid-block"]'))
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
    // The rendered grid-template-columns (label width + 1fr) must reference
    // --grid-label-width (see GridPlanner.module.css), and the scroll
    // container must have no left padding of its own. The actual resolved
    // pixel width at each viewport is a layout concern jsdom can't see - see
    // the Playwright viewport pass for that.
    render(<App />);

    const timeHeader = document.querySelector('[data-testid="time-header"]') as HTMLElement;
    expect(timeHeader.style.gridTemplateColumns).toBe('var(--grid-label-width) 1fr');

    const css = readFileSync(
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.module.css'),
      'utf8',
    );
    expect(css).toMatch(/\.grid-body__scroll\s*{[^}]*padding:\s*0 26px 0 0/);
  });

  it('sizes the time header and every venue row to the same explicit width, so borders span the full scrollable grid', () => {
    render(<App />);
    const timeHeader = document.querySelector('[data-testid="time-header"]') as HTMLElement;
    const venueRows = Array.from(document.querySelectorAll('[data-testid="venue-row"]')) as HTMLElement[];
    expect(venueRows.length).toBeGreaterThan(0);

    const headerWidth = timeHeader.style.width;
    expect(headerWidth).toMatch(/^calc\(var\(--grid-label-width\) \+ \d+px\)$/);
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
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.module.css'),
      'utf8',
    );
    expect(gridCss).toMatch(/\.time-header\s*{[^}]*position:\s*sticky;[^}]*top:\s*0;/);

    const globalCss = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
    expect(globalCss).toMatch(/html,\s*\n?\s*body,\s*\n?\s*#root\s*{[^}]*height:\s*100%/);
    expect(globalCss).toMatch(/body\s*{[^}]*overflow:\s*hidden/);
  });

  // jsdom has no layout engine (offsetWidth/clientWidth are always 0), so
  // useOverflowFilters can never measure a real overflow here - it falls
  // back to "everything fits", which is also exactly the state that should
  // make More… disappear entirely. The reverse (More… appearing once real
  // content actually overflows a real viewport) is a layout behavior and
  // belongs to the Playwright pass instead (see CLAUDE.md).
  it('renders every filter inline with no More… button when nothing needs to collapse', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: /^More/ })).not.toBeInTheDocument();
    for (const label of ['Venue', 'Shows', 'Time', 'Day', 'Age', 'Content']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
  });
});
