import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { shows } from '../../lib/loadData';
import { switchToCards } from '../../test/appTestUtils';

// The pin-board blurb is capped at 256 characters upstream and is an edited
// teaser, not a prefix of the real thing - so the panel collapses to the blurb
// and expands to the full description scraped off the show's ticket page (see
// scraper/lib/meta.mjs). Assertions read the expected prose out of the real
// data rather than hardcoding it, so a re-scrape can't rot the test.
function showByTitle(title: string) {
  const show = shows.find((s) => s.title === title);
  if (!show) throw new Error(`no show titled "${title}" in the scraped data`);
  return show;
}

function openDetail(title: string) {
  const card = screen.getByText(title).closest('[data-testid="show-card"]') as HTMLElement;
  fireEvent.click(within(card).getByRole('button', { name: `Details for ${title}` }));
  return document.querySelector('[data-testid="detail-panel"]') as HTMLElement;
}

describe('DetailPanel description', () => {
  it('collapses to the blurb, with a toggle for the full description', () => {
    render(<App />);
    switchToCards();
    const show = showByTitle('Terrible Fish');

    const panel = openDetail('Terrible Fish');

    expect(panel.textContent).toContain(show.blurb);
    expect(panel.textContent).not.toContain(show.description.at(-1));

    const toggle = within(panel).getByRole('button', { name: /more/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands to every description paragraph and collapses back', () => {
    render(<App />);
    switchToCards();
    const show = showByTitle('Terrible Fish');

    const panel = openDetail('Terrible Fish');
    fireEvent.click(within(panel).getByRole('button', { name: /more/i }));

    for (const paragraph of show.description) {
      expect(panel.textContent).toContain(paragraph);
    }
    expect(panel.textContent).not.toContain(show.blurb);

    const toggle = within(panel).getByRole('button', { name: /less/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // aria-controls must point at an element that actually exists while open.
    expect(document.getElementById(toggle.getAttribute('aria-controls') as string)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(panel.textContent).toContain(show.blurb);
  });

  it('opens collapsed again when a different show is opened while expanded', () => {
    render(<App />);
    switchToCards();
    const other = showByTitle('Metal Box');

    fireEvent.click(within(openDetail('Terrible Fish')).getByRole('button', { name: /more/i }));

    const panel = openDetail('Metal Box');
    expect(panel.textContent).toContain(other.blurb);
    expect(within(panel).getByRole('button', { name: /more/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
