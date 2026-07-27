import { render, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { switchToCards, switchToGridFrom } from '../../test/appTestUtils';

describe('App (Card Browser)', () => {
  it('switches from Grid to Cards via the shared top bar toggle, and back', () => {
    render(<App />);
    expect(document.querySelector('[data-testid="card-browser"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid="grid-planner"]')).toBeInTheDocument();

    switchToCards();
    expect(document.querySelector('[data-testid="card-browser"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="grid-planner"]')).not.toBeInTheDocument();

    switchToGridFrom(document.querySelector('[data-testid="card-browser"]') as HTMLElement);
    expect(document.querySelector('[data-testid="grid-planner"]')).toBeInTheDocument();
  });

  it('reuses the same FilterBar and TopBar components as Grid Planner', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('[data-testid="card-browser"]') as HTMLElement);
    expect(browser.getByText('FILTER')).toBeInTheDocument(); // FilterBar label
    expect(
      document.querySelector('[data-testid="card-browser"] [data-testid="topbar-wordmark"]')?.textContent,
    ).toBe('Halifax Fringe Planner'); // TopBar wordmark
  });

  it('omits the search field and starting-soon band from the original mockup', () => {
    render(<App />);
    switchToCards();
    const browser = document.querySelector('[data-testid="card-browser"]') as HTMLElement;
    expect(browser.querySelector('.starting-soon')).not.toBeInTheDocument();
    expect(within(browser).queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("star button toggles all of a show's in-filter performances at once", () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('[data-testid="card-browser"]') as HTMLElement);

    // Peak Twins has exactly one performance on each of 6 days.
    const card = browser.getByText('Peak Twins').closest('[data-testid="show-card"]') as HTMLElement;
    const star = within(card).getByRole('button', { name: /Add all of Peak Twins/ });

    fireEvent.click(star);
    expect(browser.getByText('6 PICKED')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /Remove Peak Twins/ }));
    expect(browser.getByText('0 PICKED')).toBeInTheDocument();
  });

  it('clicking a day-rail cell with a single performance toggles it directly', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('[data-testid="card-browser"]') as HTMLElement);

    const card = browser.getByText('Peak Twins').closest('[data-testid="show-card"]') as HTMLElement;
    const sep3Cell = within(card).getByRole('button', { name: /Thu 3.*performance/ });
    expect(sep3Cell).toBeDefined();

    fireEvent.click(sep3Cell!);
    expect(browser.getByText('1 PICKED')).toBeInTheDocument();
    // The aria-label already encodes cell state ("...picked"), so assert on
    // the accessible name rather than the (now CSS-Modules-hashed) class.
    expect(sep3Cell!.getAttribute('aria-label')).toContain('picked');
  });

  it('clicking a day-rail cell with multiple performances expands the time pill list instead of picking', () => {
    render(<App />);
    switchToCards();
    const browser = within(document.querySelector('[data-testid="card-browser"]') as HTMLElement);

    // APPLES! as told by an expert has two performances on Sep 3 (3:30pm, 6:30pm).
    const card = browser.getByText('APPLES! as told by an expert').closest('[data-testid="show-card"]') as HTMLElement;
    expect(within(card).queryByText(/PM$/)).not.toBeInTheDocument(); // not expanded yet

    const sep3Cell = within(card).getByRole('button', { name: /Thu 3.*performances/ });
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
    const browser = within(document.querySelector('[data-testid="card-browser"]') as HTMLElement);

    const card = browser.getByText('APPLES! as told by an expert').closest('[data-testid="show-card"]') as HTMLElement;
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
    const browser = within(document.querySelector('[data-testid="card-browser"]') as HTMLElement);

    const card = browser.getByText('Peak Twins').closest('[data-testid="show-card"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Add all of Peak Twins/ }));

    const rail = document.querySelector('[data-testid="my-fringe-rail"]') as HTMLElement;
    expect(rail).toBeInTheDocument();
    const railScope = within(rail);
    expect(railScope.getByText('6 PICKED')).toBeInTheDocument();
    expect(railScope.getAllByText('Peak Twins').length).toBe(6);

    fireEvent.click(railScope.getAllByRole('button', { name: /Remove Peak Twins/ })[0]);
    expect(railScope.getByText('5 PICKED')).toBeInTheDocument();
  });
});
