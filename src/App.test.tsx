import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App (Grid Planner)', () => {
  it('renders without throwing and shows the wordmark', () => {
    render(<App />);
    expect(screen.getByText('HALIFAX FRINGE')).toBeInTheDocument();
  });

  it('renders a day strip with 11 festival days', () => {
    render(<App />);
    expect(screen.getAllByText(/shows$/).length).toBe(11);
  });

  it('renders grid blocks for the selected day and toggling a pick updates the My Fringe counter', () => {
    render(<App />);
    const badgeBefore = screen.getByText('0');
    expect(badgeBefore).toBeInTheDocument();

    const blocks = document.querySelectorAll('.grid-block');
    expect(blocks.length).toBeGreaterThan(0);

    fireEvent.click(blocks[0]);

    // Badge should now read 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('opens the detail panel when the info button is clicked, without also toggling the pick', () => {
    render(<App />);
    const infoButtons = screen.getAllByRole('button', { name: /Details for/ });
    expect(infoButtons.length).toBeGreaterThan(0);

    fireEvent.click(infoButtons[0]);

    expect(document.querySelector('.detail-panel')).toBeInTheDocument();
    // stopPropagation means the pick count should still be 0
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
