import { fireEvent, screen, within } from '@testing-library/react';

// GridPlanner and CardBrowser each render exactly one tree now (desktop and
// mobile were merged; CSS media queries alone repaint the same DOM). App.tsx
// itself still mounts only one of GridPlanner/CardBrowser at a time based on
// view mode, so a plain `screen`/`document` query is unambiguous.

// The top bar toggle is a flip button, not a segmented control: it always
// shows the CURRENT view and switches to the other one when clicked - so
// switching TO Cards means clicking the button while it reads "Grid" (see
// TopBar.tsx). Named for what it does, not for the button text it happens to
// click, since that text is the opposite of the view you're headed to.
export function switchToCards() {
  fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
}

export function switchToGridFrom(scope: HTMLElement) {
  fireEvent.click(within(scope).getByRole('button', { name: 'Cards' }));
}
