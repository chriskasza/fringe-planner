import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { mobileEl, mobile } from '../../test/appTestUtils';
import { LABEL_WIDTH } from './gridLayout';

describe('App (mobile Grid Planner)', () => {
  it('shows the shortened wordmark (not the selected date) alongside just the view toggle and My Fringe', () => {
    // Drops "Halifax" (not the full "Halifax Fringe Planner") specifically
    // so the wordmark, view toggle and My Fringe all fit on the same line on
    // a phone. The Filters button that used to live here is gone - filters
    // live in the FilterBar row below, the same component desktop uses.
    render(<App />);
    expect(mobileEl().querySelector('[data-testid="topbar-wordmark"]')?.textContent).toBe('Fringe Planner');

    const topbar = mobileEl().querySelector('[data-testid="topbar"]') as HTMLElement;
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
    const blocks = mobileEl().querySelectorAll('[data-testid="grid-block"]');
    expect(blocks.length).toBeGreaterThan(0);

    fireEvent.click(blocks[0]);
    expect(mobile().getByText('1')).toBeInTheDocument();

    const infoButtons = mobile().getAllByRole('button', { name: /Details for/ });
    fireEvent.click(infoButtons[0]);
    expect(document.querySelector('[data-testid="detail-panel"]')).toBeInTheDocument();
  });

  it('uses a narrower venue column with no address line, clamped to 3 lines', () => {
    render(<App />);
    const label = mobileEl().querySelector('[data-testid="venue-row-label"]') as HTMLElement;
    expect(label.dataset.compact).toBe('true');
    expect(mobileEl().querySelector('[data-testid="venue-row-address"]')).not.toBeInTheDocument();

    const timeHeader = mobileEl().querySelector('[data-testid="time-header"]') as HTMLElement;
    expect(timeHeader.style.gridTemplateColumns).toMatch(/^\d+px 1fr$/);
    expect(timeHeader.style.gridTemplateColumns).not.toBe(`${LABEL_WIDTH}px 1fr`);

    const css = readFileSync(
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.module.css'),
      'utf8',
    );
    expect(css).toMatch(/\.venue-row__name--compact\s*{[^}]*-webkit-line-clamp:\s*3;/);
  });

  it('hides the grid legend on narrow phones (under ~520px)', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/GridPlanner/GridPlanner.module.css'),
      'utf8',
    );
    expect(css).toMatch(/@media \(max-width:\s*520px\)\s*{\s*\.grid-body__legend\s*{\s*display:\s*none;/);
  });
});
