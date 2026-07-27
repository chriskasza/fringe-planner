import { describe, expect, it } from 'vitest';
import { visible } from './derived';
import type { Show } from './types';

function show(warnings: string[]): Show {
  return {
    id: '1',
    title: 'APPLES!',
    blurb: '',
    poster: '',
    ticketUrl: '',
    venue: 'The Bus Stop Theatre',
    venueShort: 'BUS STOP',
    venueAddress: null,
    credits: [],
    rating: 'PG',
    warnings,
    mins: 60,
    salesEnded: false,
    timesIncomplete: false,
    perfs: [{ timeId: '1', showId: '1', day: '2026-09-03', start: 930, end: 990, mins: 60, status: 'active' }],
  };
}

const BASE_STATE = {
  excluded: {},
  daysOn: { '2026-09-03': true },
  timeBucketsOn: { matinee: true, evening: true, night: true },
  venuesOn: { 'The Bus Stop Theatre': true },
  ratingsOn: { PG: true },
  clash: 'show' as const,
  picked: new Set<string>(),
};

// Unlike Venue/Rating (one value per show), warnings is a list - visible()
// hides a show if ANY of its warnings has been switched off, and a show with
// no warnings is never affected by this filter.
describe('visible() content warnings gate', () => {
  it('is unaffected by the warnings filter when the show has none', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': false } };
    expect(visible(show([]), state, [])).toBe(true);
  });

  it('hides a show carrying a warning that has been switched off', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': false } };
    expect(visible(show(['flashing lights']), state, [])).toBe(false);
  });

  it('stays visible when all of its warnings are switched on', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': true, haze: true } };
    expect(visible(show(['flashing lights', 'haze']), state, [])).toBe(true);
  });

  it('hides a show if only one of its several warnings is switched off', () => {
    const state = { ...BASE_STATE, warningsOn: { 'flashing lights': true, haze: false } };
    expect(visible(show(['flashing lights', 'haze']), state, [])).toBe(false);
  });
});
