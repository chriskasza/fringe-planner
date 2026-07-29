import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

// Comfortably past the 250ms debounce persistence.ts writes the URL on.
const DEBOUNCE_SETTLE_MS = 400;

describe('Sync Sheet', () => {
  function openSync() {
    // My Fringe opens the picks panel, not SyncSheet directly - the panel's
    // own "sync to another device" button is the sole remaining entry point
    // into SyncSheet. Accessible name includes the badge count, so match by
    // the visible text prefix to get the button regardless of the count -
    // anchored, since the panel's own remove buttons are labeled "Remove ...
    // from My Fringe" and would otherwise also match.
    //
    // The button now toggles the panel rather than only ever opening it, so
    // only click it if the panel isn't already open (tests that call
    // openSync() twice, e.g. to close and reopen SyncSheet, would otherwise
    // toggle My Fringe closed instead of reopening SyncSheet).
    if (!document.querySelector('[data-testid="my-fringe-panel"]')) {
      fireEvent.click(screen.getByRole('button', { name: /^My Fringe/ }));
    }
    fireEvent.click(screen.getByRole('button', { name: /SYNC TO ANOTHER DEVICE/ }));
  }

  function syncScope() {
    return within(document.querySelector('[data-testid="sync-sheet"]') as HTMLElement);
  }

  it('opens from the My Fringe panel, displays the real URL hash after picking', () => {
    render(<App />);
    expect(document.querySelector('[data-testid="sync-sheet"]')).not.toBeInTheDocument();

    openSync();
    expect(document.querySelector('[data-testid="sync-sheet"]')).toBeInTheDocument();
    expect(syncScope().getByText('TAKE IT WITH YOU')).toBeInTheDocument();

    // URL box contains the hash prefix even with an empty schedule.
    const urlBox = document.querySelector('[data-testid="sync-link-row-url"]');
    expect(urlBox?.textContent).toContain('#p=');
  });

  it('shows the schedule summary matching the current state', () => {
    render(<App />);
    const blocks = document.querySelectorAll('[data-testid="grid-block-pick"]');
    fireEvent.click(blocks[0]);
    fireEvent.click(blocks[1]);

    openSync();
    expect(syncScope().getByText(/2 PERFORMANCE/)).toBeInTheDocument();
  });

  it('can be dismissed by clicking the backdrop or close button', () => {
    render(<App />);
    openSync();
    expect(document.querySelector('[data-testid="sync-sheet"]')).toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-testid="sync-backdrop"]')!);
    expect(document.querySelector('[data-testid="sync-sheet"]')).not.toBeInTheDocument();

    openSync();
    fireEvent.click(syncScope().getByRole('button', { name: 'Close sync' }));
    expect(document.querySelector('[data-testid="sync-sheet"]')).not.toBeInTheDocument();
  });

  it('renders the .ics, .json download and restore rows', () => {
    render(<App />);
    openSync();
    expect(syncScope().getByText('.ICS')).toBeInTheDocument();
    expect(syncScope().getByText('.JSON')).toBeInTheDocument();
    expect(syncScope().getByPlaceholderText(/Restore from/)).toBeInTheDocument();
  });

  // The restore row used to hand the pasted text straight to decodePicked,
  // which takes only the bare token string - so pasting the very link the
  // sheet had just produced always answered "No valid picks found".
  it('restores the schedule from a link pasted into the restore row', () => {
    render(<App />);
    const blocks = document.querySelectorAll('[data-testid="grid-block-pick"]');
    fireEvent.click(blocks[0]);
    fireEvent.click(blocks[1]);

    openSync();
    // Exactly the string the sheet offers for copying.
    const link = document.querySelector('[data-testid="sync-link-row-url"]')!.textContent as string;
    expect(link).toMatch(/#p=.+/);

    // Clear the schedule, then paste the link back in.
    fireEvent.click(syncScope().getByRole('button', { name: 'Close sync' }));
    fireEvent.click(document.querySelectorAll('[data-testid="grid-block-pick"]')[0]);
    fireEvent.click(document.querySelectorAll('[data-testid="grid-block-pick"]')[1]);
    openSync();
    expect(syncScope().getByText(/^0 PERFORMANCE/)).toBeInTheDocument();

    const input = syncScope().getByPlaceholderText(/Restore from/);
    fireEvent.paste(input, { clipboardData: { getData: () => link } });

    expect(syncScope().getByText('Restored 2 performances.')).toBeInTheDocument();
    expect(syncScope().getByText(/^2 PERFORMANCE/)).toBeInTheDocument();
  });

  // Picks are written with replaceState, which never fires popstate. The old
  // guard set a flag before each of those writes and cleared it in the
  // popstate handler, so the flag was still set when the first genuine Back
  // arrived and that navigation was ignored: the address bar changed and the
  // schedule on screen didn't.
  it('applies the hash from a genuine Back navigation', async () => {
    render(<App />);
    const blocks = () => document.querySelectorAll('[data-testid="grid-block-pick"]');

    fireEvent.click(blocks()[0]);
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    const onePickHash = window.location.hash;
    expect(onePickHash).toMatch(/#p=.+/);

    fireEvent.click(blocks()[1]);
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    expect(window.location.hash).not.toBe(onePickHash);
    expect(screen.getByText('2')).toBeInTheDocument();

    // What the browser does on Back: the URL is already the earlier one by
    // the time the event fires.
    window.history.replaceState(null, '', onePickHash);
    fireEvent.popState(window);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('disables the .ics and .json export buttons until something is picked', () => {
    // Other tests in this file pick shows and (after their debounce) persist
    // that to the URL hash and localStorage - reset both so this test's
    // "nothing picked" starting point holds regardless of run order.
    window.location.hash = '';
    window.localStorage.clear();

    render(<App />);
    openSync();
    expect(syncScope().getByText('.ICS').closest('button')).toBeDisabled();
    expect(syncScope().getByText('.JSON').closest('button')).toBeDisabled();

    fireEvent.click(syncScope().getByRole('button', { name: 'Close sync' }));
    fireEvent.click(document.querySelectorAll('[data-testid="grid-block-pick"]')[0]);
    openSync();

    expect(syncScope().getByText('.ICS').closest('button')).not.toBeDisabled();
    expect(syncScope().getByText('.JSON').closest('button')).not.toBeDisabled();
  });

  it('reports unusable restore input instead of silently doing nothing', () => {
    render(<App />);
    openSync();
    const input = syncScope().getByPlaceholderText(/Restore from/);
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://example.test/not-a-schedule' } });
    expect(syncScope().getByText('No valid picks found in that link or file.')).toBeInTheDocument();
  });
});
