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

// jsdom doesn't implement matchMedia at all - useIsNarrow (used by GridBody
// for the responsive slot width) would throw on mount otherwise. Always
// reports "not narrow": jsdom has no real viewport to test a breakpoint
// against, so every existing pixel-math assertion here keeps assuming the
// desktop SLOT_WIDTH, same as before this stub existed. The reverse (the
// query actually matching at a real narrow viewport) is a layout behavior
// and belongs to the Playwright pass instead (see CLAUDE.md).
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList) as unknown as typeof window.matchMedia;

