import { useLayoutEffect, useRef, useState } from 'react';

// Pure cutoff math, unit-testable without touching the DOM: how many items
// (in priority order) fit in `containerWidth` once `reservedWidth` (the
// always-visible controls - label, Conflicts, More, Reset, summary) and the
// gap between every rendered element are accounted for.
export function computeVisibleCount(
  itemWidths: number[],
  reservedWidth: number,
  containerWidth: number,
  gap: number,
): number {
  const available = containerWidth - reservedWidth;
  let used = 0;
  let count = 0;
  for (const width of itemWidths) {
    const next = used + width + gap;
    if (next > available) break;
    used = next;
    count++;
  }
  return count;
}

// Fits as many of the first `itemCount` priority filter items inline as the
// container has room for; the rest report as hidden so the caller can render
// them into the overflow modal instead. Consumers must keep every item
// mounted regardless of visibleCount - position:absolute + visibility:hidden,
// never display:none - so its real content width can keep being measured.
// Hiding it from layout entirely would freeze its width at whatever it was
// the last time it was visible, which goes stale the moment a filter's own
// label text changes length (e.g. "ALL 12" -> a single venue name).
export function useOverflowFilters(itemCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visibleCount, setVisibleCount] = useState(itemCount);

  function measure() {
    const container = containerRef.current;
    if (!container) return;
    // A container that hasn't been laid out yet reports 0 for every
    // dimension (jsdom, which has no layout engine at all, always does) -
    // treat that as "can't measure" and keep the current count rather than
    // collapsing everything to hidden.
    if (container.clientWidth === 0) return;
    const style = getComputedStyle(container);
    const gap = parseFloat(style.columnGap) || 0;
    // clientWidth includes the container's own left/right padding, but that
    // padding isn't usable space for its flex children - counting it as
    // available let one extra item claim room that wasn't really there,
    // pushing Reset All (and the trailing summary) past the actual edge.
    const horizontalPadding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const reservedEls = container.querySelectorAll<HTMLElement>('[data-overflow-reserved]');
    const reservedWidth = Array.from(reservedEls).reduce((sum, el) => sum + el.offsetWidth + gap, 0);
    const itemWidths = itemRefs.current.slice(0, itemCount).map((el) => el?.offsetWidth ?? 0);
    const next = computeVisibleCount(itemWidths, reservedWidth, container.clientWidth - horizontalPadding, gap);
    setVisibleCount((prev) => (prev === next ? prev : next));
  }

  // Re-measure on every render, not just on resize: a filter's own label can
  // change width when its selection changes, which can shift how many
  // siblings fit without the container itself resizing.
  useLayoutEffect(() => {
    measure();
  });

  // Width changes that don't originate from a React render - window resize,
  // the My Fringe rail collapsing - need their own trigger. Set up once;
  // `itemCount` is a fixed-length priority list, never changes at runtime.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function itemRef(index: number) {
    return (el: HTMLDivElement | null) => {
      itemRefs.current[index] = el;
    };
  }

  return { containerRef, itemRef, visibleCount };
}
