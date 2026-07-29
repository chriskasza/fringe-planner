import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../state/AppContext';
import { FiltersOverflowModal, MoreFiltersButton } from './FiltersOverflowModal';

// The More… button's own click/open/close/tap-through wiring, tested
// directly rather than through the real FilterBar - whether More… is
// present at all in a given layout is a width-driven decision jsdom can't
// make (see the "no More… button when nothing needs to collapse" test in
// GridPlanner.test.tsx and the Playwright pass in CLAUDE.md), but once it
// exists, clicking it and interacting with the modal it opens has nothing to
// do with layout.
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
    expect(document.querySelector('[data-testid="filters-overflow-overlay"]')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^More/ }));

    const overlay = document.querySelector('[data-testid="filters-overflow-overlay"]');
    expect(overlay).toBeInTheDocument();
    for (const label of ['Day', 'Time', 'Venue', 'Age', 'Content', 'Overlaps', 'Shows']) {
      expect(within(overlay as HTMLElement).getByText(label)).toBeInTheDocument();
    }
  });

  it('starts every section collapsed, with each expandable independently', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));

    const overlay = document.querySelector('[data-testid="filters-overflow-overlay"]') as HTMLElement;
    const dayHeader = within(overlay).getByRole('button', { name: /Day/ });
    const venueHeader = within(overlay).getByRole('button', { name: /Venue/ });
    expect(dayHeader).toHaveAttribute('aria-expanded', 'false');
    expect(venueHeader).toHaveAttribute('aria-expanded', 'false');
    expect(within(overlay).queryByText('Fri 4 Sep')).not.toBeInTheDocument();

    fireEvent.click(dayHeader);
    expect(dayHeader).toHaveAttribute('aria-expanded', 'true');
    expect(within(overlay).getByText('Fri 4 Sep')).toBeInTheDocument();
    // Opening Day doesn't touch Venue's own state.
    expect(venueHeader).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(venueHeader);
    expect(venueHeader).toHaveAttribute('aria-expanded', 'true');
    // Both stay open at once.
    expect(dayHeader).toHaveAttribute('aria-expanded', 'true');
    expect(within(overlay).getByText('Fri 4 Sep')).toBeInTheDocument();

    fireEvent.click(dayHeader);
    expect(dayHeader).toHaveAttribute('aria-expanded', 'false');
    expect(within(overlay).queryByText('Fri 4 Sep')).not.toBeInTheDocument();
  });

  it('resets to fully collapsed each time it is reopened', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));
    const overlay = () => document.querySelector('[data-testid="filters-overflow-overlay"]') as HTMLElement;

    fireEvent.click(within(overlay()).getByRole('button', { name: /Day/ }));
    expect(within(overlay()).getByText('Fri 4 Sep')).toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-testid="filters-overflow-backdrop"]')!);
    expect(document.querySelector('[data-testid="filters-overflow-overlay"]')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^More/ }));
    expect(within(overlay()).getByRole('button', { name: /Day/ })).toHaveAttribute('aria-expanded', 'false');
    expect(within(overlay()).queryByText('Fri 4 Sep')).not.toBeInTheDocument();
  });

  it('stays open when a control inside it is tapped, and toggles that control', () => {
    // Real taps dispatch mousedown before click; FilterBar's own outside-click
    // listener (live at every width, since desktop and mobile are both always
    // mounted) used to unmount a sibling copy of this sheet on that mousedown,
    // before the tap ever reached the control inside it.
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));

    const overlay = () => document.querySelector('[data-testid="filters-overflow-overlay"]') as HTMLElement;
    fireEvent.click(within(overlay()).getByRole('button', { name: /Day/ }));
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
    expect(document.querySelector('[data-testid="filters-overflow-overlay"]')).toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-testid="filters-overflow-backdrop"]')!);
    expect(document.querySelector('[data-testid="filters-overflow-overlay"]')).not.toBeInTheDocument();
  });
});
