import { render, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dropdown } from './Dropdown';

describe('Dropdown', () => {
  function renderOpen(onClose = () => {}) {
    return render(
      <Dropdown open title="Venue" width={200} onClose={onClose}>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Dropdown>,
    );
  }

  it('renders nothing when closed', () => {
    render(
      <Dropdown open={false} title="Venue" width={200} onClose={() => {}}>
        <button type="button">First</button>
      </Dropdown>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus to the panel on open', () => {
    renderOpen();
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Venue' }));
  });

  it('calls onClose on Escape', () => {
    let closed = false;
    renderOpen(() => {
      closed = true;
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  // Tab-wrap can't be asserted here: focus-trap's tabbable-element lookup
  // (the `tabbable` package) treats an element as hidden whenever
  // `getClientRects().length === 0`, which is every element under jsdom -
  // it does no layout, so this always returns empty (verified directly:
  // `tabbable(container).length` is 0 in this environment no matter what's
  // inside it). Same class of gap as the overflow-filter jsdom notes
  // elsewhere in this codebase - real Tab/Shift+Tab wraparound is covered by
  // the Playwright viewport pass (`npm run test:visual`) instead, where
  // layout is real.
});
