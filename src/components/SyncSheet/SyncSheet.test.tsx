import { render, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { desktopEl, desktop } from '../../test/appTestUtils';

// Comfortably past the 250ms debounce persistence.ts writes the URL on.
const DEBOUNCE_SETTLE_MS = 400;

describe('Sync Sheet', () => {
  function openSync() {
    // Accessible name includes the badge count, so match by the visible
    // text prefix to get the button regardless of the count.
    fireEvent.click(desktop().getByRole('button', { name: /My Fringe/ }));
  }

  function syncScope() {
    return within(document.querySelector('.sync-sheet') as HTMLElement);
  }

  it('opens from the My Fringe button, displays the real URL hash after picking', () => {
    render(<App />);
    expect(document.querySelector('.sync-sheet')).not.toBeInTheDocument();

    openSync();
    expect(document.querySelector('.sync-sheet')).toBeInTheDocument();
    expect(syncScope().getByText('TAKE IT WITH YOU')).toBeInTheDocument();

    // URL box contains the hash prefix even with an empty schedule.
    const urlBox = document.querySelector('.sync-link-row__url');
    expect(urlBox?.textContent).toContain('#p=');
  });

  it('shows the schedule summary matching the current state', () => {
    render(<App />);
    const blocks = desktopEl().querySelectorAll('.grid-block');
    fireEvent.click(blocks[0]);
    fireEvent.click(blocks[1]);

    openSync();
    expect(syncScope().getByText(/2 PERFORMANCE/)).toBeInTheDocument();
  });

  it('can be dismissed by clicking the backdrop or close button', () => {
    render(<App />);
    openSync();
    expect(document.querySelector('.sync-sheet')).toBeInTheDocument();

    fireEvent.click(document.querySelector('.sync-backdrop')!);
    expect(document.querySelector('.sync-sheet')).not.toBeInTheDocument();

    openSync();
    fireEvent.click(syncScope().getByRole('button', { name: 'Close sync' }));
    expect(document.querySelector('.sync-sheet')).not.toBeInTheDocument();
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
    const blocks = desktopEl().querySelectorAll('.grid-block');
    fireEvent.click(blocks[0]);
    fireEvent.click(blocks[1]);

    openSync();
    // Exactly the string the sheet offers for copying.
    const link = document.querySelector('.sync-link-row__url')!.textContent as string;
    expect(link).toMatch(/#p=.+/);

    // Clear the schedule, then paste the link back in.
    fireEvent.click(syncScope().getByRole('button', { name: 'Close sync' }));
    fireEvent.click(desktopEl().querySelectorAll('.grid-block')[0]);
    fireEvent.click(desktopEl().querySelectorAll('.grid-block')[1]);
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
    const blocks = () => desktopEl().querySelectorAll('.grid-block');

    fireEvent.click(blocks()[0]);
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    const onePickHash = window.location.hash;
    expect(onePickHash).toMatch(/#p=.+/);

    fireEvent.click(blocks()[1]);
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    expect(window.location.hash).not.toBe(onePickHash);
    expect(desktop().getByText('2')).toBeInTheDocument();

    // What the browser does on Back: the URL is already the earlier one by
    // the time the event fires.
    window.history.replaceState(null, '', onePickHash);
    fireEvent.popState(window);

    expect(desktop().getByText('1')).toBeInTheDocument();
  });

  it('reports unusable restore input instead of silently doing nothing', () => {
    render(<App />);
    openSync();
    const input = syncScope().getByPlaceholderText(/Restore from/);
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://example.test/not-a-schedule' } });
    expect(syncScope().getByText('No valid picks found in that link or file.')).toBeInTheDocument();
  });
});
