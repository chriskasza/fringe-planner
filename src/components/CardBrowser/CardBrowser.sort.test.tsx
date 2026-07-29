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
function chooseSort(label: 'RANDOM' | 'A–Z' | 'SOONEST') {
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
    const expected = [...shows.map((s) => s.title)].sort((a, b) => a.localeCompare(b));
    expect(cardTitles()).toEqual(expected);
  });

  it('SOONEST puts the show with the earliest upcoming performance first', () => {
    render(<App />);
    switchToCards();

    chooseSort('SOONEST');

    // The Defenestration of Prague's earliest active performance (Sep 3,
    // 2:00 PM) is the earliest in the whole dataset; APPLES! as told by an
    // expert (Sep 3, 3:30 PM) is the next-soonest.
    const displayed = cardTitles();
    expect(displayed[0]).toBe('The Defenestration of Prague');
    expect(displayed[1]).toBe('APPLES! as told by an expert');
  });

  it('RESET ALL leaves the sort selection untouched', () => {
    render(<App />);
    switchToCards();
    const browser = within(cardBrowserEl());

    chooseSort('SOONEST');
    fireEvent.click(browser.getByRole('button', { name: 'RESET ALL' }));

    expect(cardTitles()[0]).toBe('The Defenestration of Prague');
  });
});
