import { describe, expect, it } from 'vitest';
import { activeFilterCount, summarizeCount, summarizeLabelled, summarizeSelected } from './filterSummary';

// Every filter button should read in one grammar: ALL n / NONE / n OF m,
// with Day and Time naming a lone selection because their labels are short.
describe('filter button summaries', () => {
  const days = ['a', 'b', 'c'];
  const on = (...keys: string[]) => Object.fromEntries(days.map((d) => [d, keys.includes(d)]));

  it('uses one grammar across all/none/partial', () => {
    expect(summarizeSelected(3, 3)).toBe('ALL 3');
    expect(summarizeSelected(0, 3)).toBe('NONE');
    expect(summarizeSelected(2, 3)).toBe('2 OF 3');
    expect(summarizeSelected(1, 3)).toBe('1 OF 3');
  });

  it('names a lone selection for labelled filters, counts otherwise', () => {
    const labelFor = (k: string) => k.toUpperCase();
    expect(summarizeLabelled(on('a'), days, labelFor)).toBe('A');
    expect(summarizeLabelled(on('a', 'b'), days, labelFor)).toBe('2 OF 3');
    expect(summarizeLabelled(on('a', 'b', 'c'), days, labelFor)).toBe('ALL 3');
    expect(summarizeLabelled(on(), days, labelFor)).toBe('NONE');
  });

  it('stays numeric for long-labelled filters, including a lone selection', () => {
    // Previously returned a bare "1", which read as a different grammar from
    // the "n OF m" the other buttons used.
    expect(summarizeCount(on('a'), days)).toBe('1 OF 3');
    expect(summarizeCount(on('a', 'b'), days)).toBe('2 OF 3');
    expect(summarizeCount(on('a', 'b', 'c'), days)).toBe('ALL 3');
    expect(summarizeCount(on(), days)).toBe('NONE');
  });
});

describe('activeFilterCount', () => {
  const base = {
    daysOn: { a: true, b: true },
    timeBucketsOn: { m: true },
    venuesOn: { v: true },
    ratingsOn: { r: true },
    warningsOn: { w: true },
    excluded: {},
    clash: 'show',
  };

  it('is zero when nothing is filtered', () => {
    expect(activeFilterCount(base)).toBe(0);
  });

  it('counts each switched-off option, excluded show, and a non-default clash mode', () => {
    expect(activeFilterCount({ ...base, daysOn: { a: true, b: false } })).toBe(1);
    expect(activeFilterCount({ ...base, warningsOn: { w: false } })).toBe(1);
    expect(activeFilterCount({ ...base, excluded: { s1: true, s2: true } })).toBe(2);
    expect(activeFilterCount({ ...base, clash: 'hide' })).toBe(1);
  });
});
