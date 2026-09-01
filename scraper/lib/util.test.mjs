import { describe, expect, it } from 'vitest';
import { addMinutes, cleanShowTitle, durationMinutes, isCancelledTitle } from './util.mjs';

describe('addMinutes', () => {
  it('adds within the same day', () => {
    expect(addMinutes('2026-09-06T13:00', 240)).toBe('2026-09-06T17:00');
  });

  // The reason this helper exists: the Late Night Cabaret runs 23:00-01:00.
  it('rolls the date over at midnight', () => {
    expect(addMinutes('2026-09-03T23:00', 120)).toBe('2026-09-04T01:00');
  });

  it('rolls over a month boundary', () => {
    expect(addMinutes('2026-08-31T23:30', 60)).toBe('2026-09-01T00:30');
  });

  it('rejects a stamp it cannot parse', () => {
    expect(() => addMinutes('nonsense', 60)).toThrow(/unparseable/);
  });
});

describe('durationMinutes', () => {
  it('measures within a day', () => {
    expect(durationMinutes('2026-09-06T13:00', '2026-09-06T17:00')).toBe(240);
  });

  it('measures across midnight', () => {
    expect(durationMinutes('2026-09-03T23:00', '2026-09-04T01:00')).toBe(120);
  });

  // The upstream defect this guard exists to catch.
  it('measures the bogus +24h end SimpleTix reports for the Late Night Cabaret', () => {
    expect(durationMinutes('2026-09-03T23:00', '2026-09-04T23:00')).toBe(1440);
  });
});

describe('cleanShowTitle', () => {
  const free = [
    ['FREE - Halifax Fringe Sampler (No Tickets Required, Just Show Up!)', 'Halifax Fringe Sampler'],
    ['FREE - Late Night Cabaret (No Tickets Required, Just Show Up!)', 'Late Night Cabaret'],
    ['FREE - Kids Fringe (No Tickets Required, Just Show Up!)', 'Kids Fringe'],
  ];

  for (const [raw, expected] of free) {
    it(`strips the decoration from ${JSON.stringify(raw)}`, () => {
      expect(cleanShowTitle(raw)).toEqual({ title: expected, freeAdmission: true });
    });
  }

  it('leaves an ordinary title alone', () => {
    expect(cleanShowTitle('The Defenestration of Prague')).toEqual({
      title: 'The Defenestration of Prague',
      freeAdmission: false,
    });
  });

  // The cancellation prefix is a separate upstream signal read off the *stored*
  // title by isCancelledTitle -- stripping it here would silently un-cancel a show.
  it('leaves a CANCELLED prefix intact', () => {
    const raw = 'CANCELLED: Le Début des Yeux // Everything is Sparkle Sparkle';
    expect(cleanShowTitle(raw).title).toBe(raw);
    expect(isCancelledTitle(cleanShowTitle(raw).title)).toBe(true);
  });

  it('does not treat a title that merely starts with the word free as free', () => {
    expect(cleanShowTitle('Free Fall')).toEqual({ title: 'Free Fall', freeAdmission: false });
  });
});
