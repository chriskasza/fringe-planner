import { fireEvent, within } from '@testing-library/react';

// The mobile Grid Planner reuses the same components as desktop (shared
// wordmark, grid blocks, badges, etc.), both rendered at once and toggled
// via a CSS media query - so tests about desktop-specific behavior need to
// scope their queries to the desktop tree, not the whole document.
export function desktopEl(): HTMLElement {
  return document.querySelector('[data-testid="grid-planner-desktop"]') as HTMLElement;
}

export function desktop() {
  return within(desktopEl());
}

export function mobileEl(): HTMLElement {
  return document.querySelector('[data-testid="grid-planner-mobile"]') as HTMLElement;
}

export function mobile() {
  return within(mobileEl());
}

// The top bar toggle is a flip button, not a segmented control: it always
// shows the CURRENT view and switches to the other one when clicked - so
// switching TO Cards means clicking the button while it reads "Grid" (see
// TopBar.tsx). Named for what it does, not for the button text it happens to
// click, since that text is the opposite of the view you're headed to.
export function switchToCards() {
  fireEvent.click(desktop().getByRole('button', { name: 'Grid' }));
}

export function switchToGridFrom(scope: HTMLElement) {
  fireEvent.click(within(scope).getByRole('button', { name: 'Cards' }));
}
