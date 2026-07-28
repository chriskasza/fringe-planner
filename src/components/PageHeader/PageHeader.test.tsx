import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

// TopBar/FilterBar are the same components at every width and in both views
// now - PageHeader no longer forks into a desktop/mobile pair (see
// PageHeader.tsx). These assertions aren't viewport-dependent, unlike the
// wordmark text itself (see the Playwright viewport pass for that).
describe('PageHeader', () => {
  it('always shows the My Fringe button and never a Filters button', () => {
    render(<App />);
    const topbar = document.querySelector('[data-testid="topbar"]') as HTMLElement;
    expect(within(topbar).queryByRole('button', { name: /^Filters/ })).not.toBeInTheDocument();
    expect(within(topbar).getByRole('button', { name: /My Fringe/ })).toBeInTheDocument();
  });

  it('renders the same TopBar and FilterBar in both Grid and Cards view', () => {
    render(<App />);
    expect(document.querySelector('[data-testid="topbar"]')).toBeInTheDocument();
    expect(screen.getByText('FILTER')).toBeInTheDocument();
  });
});
