import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine and doesn't implement ResizeObserver at all -
// components that use it (useOverflowFilters) would throw on mount otherwise.
// This is a no-op stand-in, not a layout simulation: offsetWidth/clientWidth
// are 0 under jsdom regardless, so overflow behavior itself is verified with
// Playwright (see CLAUDE.md), not here.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

