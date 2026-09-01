import { render, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { shows } from '../../lib/loadData';
import { switchToCards } from '../../test/appTestUtils';

const cardBrowserEl = () => document.querySelector('[data-testid="card-browser"]') as HTMLElement;
const cardTitles = () =>
  Array.from(cardBrowserEl().querySelectorAll('[data-testid="show-card"] h3')).map((el) => el.textContent);

// The Sort control is a FilterButton + Dropdown like Venue/Day/etc, but
// single-select: picking an option (a RadioRow) closes the menu itself
// rather than leaving it open for further toggling.
function chooseSort(label: 'Random' | 'A–Z' | 'Soonest') {
  const browser = within(cardBrowserEl());
  fireEvent.click(browser.getByRole('button', { name: /^Sort/ }));
  fireEvent.click(within(browser.getByRole('dialog', { name: 'Sort' })).getByRole('menuitemradio', { name: label }));
}

describe('Card Browser sort', () => {
  it('defaults to a random order containing every visible show exactly once', () => {
    render(<App />);
    switchToCards();

    const displayed = cardTitles();
    expect(displayed.length).toBe(shows.length);
    expect([...displayed].sort()).toEqual([...shows.map((s) => s.title)].sort());
  });

  it('does not reshuffle the random order on an unrelated re-render', () => {
    render(<App />);
    switchToCards();
    const browser = within(cardBrowserEl());

    const before = cardTitles();
    // Open then close an unrelated dropdown - a re-render that must not touch
    // sort order, since Random is meant to hold still while browsing.
    fireEvent.click(browser.getByRole('button', { name: /^Day/ }));
    fireEvent.click(browser.getByRole('button', { name: /^Day/ }));
    expect(cardTitles()).toEqual(before);
  });

  it('A–Z sorts cards alphabetically by title, and closes the menu on selection', () => {
    render(<App />);
    switchToCards();
    const browser = within(cardBrowserEl());

    chooseSort('A–Z');

    expect(browser.queryByRole('dialog', { name: 'Sort' })).not.toBeInTheDocument();
    // Cancelled shows sort to the bottom under every mode - there's nothing to
    // plan around them - so A-Z means A-Z within each of the two groups.
    const expected = [...shows]
      .sort((a, b) => a.title.localeCompare(b.title))
      .sort((a, b) => Number(a.cancelled) - Number(b.cancelled))
      .map((s) => s.title);
    expect(cardTitles()).toEqual(expected);
  });

  it('sinks cancelled shows to the bottom of an A–Z sort', () => {
    render(<App />);
    switchToCards();

    chooseSort('A–Z');

    const titles = cardTitles();
    const cancelled = shows.filter((s) => s.cancelled).map((s) => s.title);
    expect(cancelled.length).toBeGreaterThan(0);
    expect(titles.slice(-cancelled.length).every((t) => cancelled.includes(t as string))).toBe(true);
    // ...and on title alone they'd land well above the bottom, so the
    // partition is doing real work rather than agreeing with A–Z by accident.
    const byTitle = [...titles].sort((a, b) => (a as string).localeCompare(b as string));
    for (const t of cancelled) {
      expect(byTitle.indexOf(t)).toBeLessThan(titles.indexOf(t));
    }
  });

  it('Soonest puts the show with the earliest upcoming performance first', () => {
    render(<App />);
    switchToCards();

    chooseSort('Soonest');

    // The Halifax Fringe Sampler (the free Sep 2 preview, 7:00 PM) is the
    // earliest in the whole dataset; The Defenestration of Prague (Sep 3,
    // 2:00 PM) is the earliest of the ticketed shows and next-soonest.
    const displayed = cardTitles();
    expect(displayed[0]).toBe('Halifax Fringe Sampler');
    expect(displayed[1]).toBe('The Defenestration of Prague');
  });

  it('RESET ALL leaves the sort selection untouched', () => {
    render(<App />);
    switchToCards();
    const browser = within(cardBrowserEl());

    chooseSort('Soonest');
    fireEvent.click(browser.getByRole('button', { name: 'RESET ALL' }));

    expect(cardTitles()[0]).toBe('Halifax Fringe Sampler');
  });
});
