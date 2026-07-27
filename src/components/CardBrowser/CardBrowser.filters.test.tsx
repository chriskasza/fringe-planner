import { render, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { shows } from '../../lib/loadData';
import { desktopEl, switchToCards, switchToGridFrom } from '../../test/appTestUtils';

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
    switchToGridFrom(document.querySelector('.card-browser') as HTMLElement);
    const sep5Tab = Array.from(desktopEl().querySelectorAll('.day-strip__tab')).find(
      (el) => el.textContent?.includes('SAT') && el.textContent?.includes('5'),
    ) as HTMLElement;
    fireEvent.click(sep5Tab);

    // Back in Cards, the original two days must still be on - now three.
    switchToCards();
    const dayMenu = openDayMenu();
    for (const label of ['Thu 3 Sep', 'Fri 4 Sep', 'Sat 5 Sep']) {
      const row = dayMenu.getByText(label).closest('label') as HTMLElement;
      expect(within(row).getByRole('checkbox')).toBeChecked();
    }
    expect(cardCount()).toBeGreaterThan(twoDayCount);
  });
});
