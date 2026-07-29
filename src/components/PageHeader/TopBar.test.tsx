import { render, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

describe('TopBar My Fringe button', () => {
  it('does not open the panel when a pick is added - only the badge pop cues it', () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('[data-testid="grid-block-pick"]')[0]);
    expect(document.querySelector('[data-testid="my-fringe-panel"]')).not.toBeInTheDocument();
  });

  it('opens the panel when clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^My Fringe/ }));
    expect(document.querySelector('[data-testid="my-fringe-panel"]')).toBeInTheDocument();
  });

  it('closes the panel when clicked again', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: /^My Fringe/ });
    fireEvent.click(button);
    expect(document.querySelector('[data-testid="my-fringe-panel"]')).toBeInTheDocument();

    fireEvent.click(button);
    expect(document.querySelector('[data-testid="my-fringe-panel"]')).not.toBeInTheDocument();
  });
});

describe('TopBar My Fringe badge pop', () => {
  // jsdom doesn't run CSS animations, so this only checks the class that
  // drives topbar-badge-pop is applied at the right times, not the replay
  // itself - the `key`-remount trick that makes it restart on every add
  // (see TopBar.tsx) needs eyeballing in a real browser.
  it('is not applied on initial mount', () => {
    render(<App />);
    expect(screen.getByTestId('topbar-myfringe-badge').className).not.toMatch(/badge--pop/);
  });

  it('is applied once a pick has been added', () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('[data-testid="grid-block-pick"]')[0]);
    expect(screen.getByTestId('topbar-myfringe-badge').className).toMatch(/badge--pop/);
  });
});
