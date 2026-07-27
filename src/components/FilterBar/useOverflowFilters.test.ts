import { describe, expect, it } from 'vitest';
import { computeVisibleCount } from './useOverflowFilters';

describe('computeVisibleCount', () => {
  it('fits every item when there is room for all of them plus the gap between each', () => {
    // 4 items x 50px + 4 gaps x 10px = 240, well under 300 reserved-adjusted room.
    expect(computeVisibleCount([50, 50, 50, 50], 100, 400, 10)).toBe(4);
  });

  it('stops as soon as the next item would overflow the available width', () => {
    // available = 250 - 100 = 150; two items fit (60 + 60 = 120), a third
    // (180) would overflow.
    expect(computeVisibleCount([50, 50, 50, 50], 100, 250, 10)).toBe(2);
  });

  it('returns 0 when even the first item does not fit', () => {
    expect(computeVisibleCount([200], 100, 250, 10)).toBe(0);
  });

  it('returns 0 for an empty item list', () => {
    expect(computeVisibleCount([], 50, 400, 10)).toBe(0);
  });

  it('accounts for the gap on every item, including the last one that fits', () => {
    // available = 100; two 40px items with a 10px gap need 40+10+40+10 = 100,
    // so both fit exactly at the boundary.
    expect(computeVisibleCount([40, 40], 0, 100, 10)).toBe(2);
    // One pixel less and the second no longer fits.
    expect(computeVisibleCount([40, 40], 0, 99, 10)).toBe(1);
  });
});
