import { render, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { shows } from '../../lib/loadData';
import { nextActivePerf } from '../../lib/derived';
import { nowInHalifax } from '../../lib/dates';
import { switchToCards } from '../../test/appTestUtils';
import type { Show } from '../../lib/types';

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

// Mirrors CardGrid's own partition: a show is spent when it was cancelled or
// has no performance left to come. Derived from the data rather than pinned,
// since which shows are spent changes every day the festival runs.
const spent = (s: Show) => s.cancelled || !nextActivePerf(s, nowInHalifax());

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
      .sort((a, b) => Number(spent(a)) - Number(spent(b)))
      .map((s) => s.title);
    expect(cardTitles()).toEqual(expected);
  });

  // "Spent" is cancelled *or* fully played: both are kept listed but neither
  // can be planned around, so both belong below anything still bookable. This
  // used to assert cancelled shows alone occupied the tail, which stopped
  // being true once a played show could sit down there with them.
  it('sinks every show with nothing left to come to the bottom of an A–Z sort', () => {
    render(<App />);
    switchToCards();

    chooseSort('A–Z');

    const titles = cardTitles() as string[];
    const spentTitles = shows.filter(spent).map((s) => s.title);
    expect(spentTitles.length).toBeGreaterThan(0);
    // Every spent show sits after every show that still has something to come.
    const lastLive = Math.max(...titles.map((t, i) => (spentTitles.includes(t) ? -1 : i)));
    const firstSpent = Math.min(...titles.map((t, i) => (spentTitles.includes(t) ? i : Infinity)));
    expect(firstSpent).toBeGreaterThan(lastLive);
    // ...and on title alone at least one would land above the bottom, so the
    // partition is doing real work rather than agreeing with A–Z by accident.
    const byTitle = [...titles].sort((a, b) => a.localeCompare(b));
    expect(spentTitles.some((t) => byTitle.indexOf(t) < titles.indexOf(t))).toBe(true);
  });

  it('Soonest orders every card by its earliest upcoming performance', () => {
    render(<App />);
    switchToCards();

    chooseSort('Soonest');

    // Deliberately a property, not a pinned pair of titles. This test used to
    // name the Halifax Fringe Sampler and The Defenestration of Prague, which
    // went red the evening the Sampler played its one performance and was
    // retired out of the board - the dataset moves under this file every day
    // the festival runs, so assert the ordering rule instead of today's answer.
    const now = nowInHalifax();
    const byTitle = new Map(shows.map((s) => [s.title, s]));
    // Shows with nothing left to come sort last; \uffff puts them there.
    const sortKey = (title: string) => {
      const p = nextActivePerf(byTitle.get(title)!, now);
      return p ? `${p.day}T${String(p.start).padStart(4, '0')}` : '\uffff';
    };

    const displayed = cardTitles() as string[];
    expect(displayed.length).toBeGreaterThan(1);
    for (let i = 1; i < displayed.length; i++) {
      expect(sortKey(displayed[i - 1]) <= sortKey(displayed[i])).toBe(true);
    }
  });

  it('RESET ALL leaves the sort selection untouched', () => {
    render(<App />);
    switchToCards();
    const browser = within(cardBrowserEl());

    chooseSort('Soonest');
    const before = cardTitles();
    fireEvent.click(browser.getByRole('button', { name: 'RESET ALL' }));

    // No filters were set, so RESET ALL can't change *which* cards show - only
    // reverting the sort could reorder them. Comparing the whole list rather
    // than a named first card keeps this honest as the dataset changes.
    expect(cardTitles()).toEqual(before);
    // ...and the order has teeth only if Soonest actually differs from A-Z.
    expect(before).not.toEqual([...before].sort((a, b) => (a as string).localeCompare(b as string)));
  });
});
