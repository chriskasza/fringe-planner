import { describe, expect, it } from 'vitest';
import { generateIcs } from './ics';
import type { Perf, Show } from './types';

function show(overrides: Partial<Show> = {}): Show {
  return {
    id: '284247',
    title: 'A Show',
    blurb: '',
    description: [],
    poster: '',
    ticketUrl: 'https://example.test/tickets',
    venue: 'The Bus Stop Theatre',
    venueShort: 'BUS STOP',
    venueShortMobile: 'BUS STOP',
    venueAddress: '2203 Gottingen St',
    credits: [],
    rating: 'PG',
    warnings: [],
    warningTags: [],
    mins: 60,
    cancelled: false,
    salesEnded: false,
    timesIncomplete: false,
    perfs: [],
    ...overrides,
  };
}

// transform.ts encodes a performance that runs past midnight as end += 1440,
// so `end` can legitimately exceed a day.
function perf(start: number, end: number, day = '2026-09-11'): Perf {
  return { timeId: '1', showId: '284247', day, start, end, mins: end - start, status: 'active' };
}

function fieldsOf(ics: string, name: string): string[] {
  return ics
    .split('\r\n')
    .filter((l) => l.startsWith(name))
    .map((l) => l.slice(l.indexOf(':') + 1));
}

describe('generateIcs', () => {
  it('writes TZID-anchored local start and end times', () => {
    const s = show();
    const ics = generateIcs([{ show: s, perf: perf(19 * 60 + 30, 21 * 60) }]);
    expect(fieldsOf(ics, 'DTSTART')).toEqual(['20260911T193000']);
    expect(fieldsOf(ics, 'DTEND')).toEqual(['20260911T210000']);
    expect(ics).toContain('DTSTART;TZID=America/Halifax:');
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('skips cancelled performances', () => {
    const s = show();
    const p = { ...perf(19 * 60, 20 * 60), status: 'cancelled' as const };
    expect(fieldsOf(generateIcs([{ show: s, perf: p }]), 'DTSTART')).toEqual([]);
  });

  // Subtracting 1440 from the minutes without advancing the date produced a
  // DTEND on the *start* date, i.e. an event ending 23 hours before it began -
  // calendars either reject the VEVENT or show a negative duration.
  it('rolls DTEND onto the next day for a show that crosses midnight', () => {
    const s = show();
    const ics = generateIcs([{ show: s, perf: perf(23 * 60 + 30, 24 * 60 + 30) }]);
    expect(fieldsOf(ics, 'DTSTART')).toEqual(['20260911T233000']);
    expect(fieldsOf(ics, 'DTEND')).toEqual(['20260912T003000']);
  });

  it('rolls DTEND onto the next day for a show ending exactly at midnight', () => {
    const s = show();
    const ics = generateIcs([{ show: s, perf: perf(22 * 60 + 30, 24 * 60) }]);
    expect(fieldsOf(ics, 'DTEND')).toEqual(['20260912T000000']);
  });

  it('rolls DTEND across a month boundary', () => {
    const s = show();
    const ics = generateIcs([{ show: s, perf: perf(23 * 60, 24 * 60 + 15, '2026-09-30') }]);
    expect(fieldsOf(ics, 'DTEND')).toEqual(['20261001T001500']);
  });

  it('escapes and folds long text fields', () => {
    const s = show({ title: 'Semi; colon, comma', venue: 'X'.repeat(90), venueAddress: null });
    const ics = generateIcs([{ show: s, perf: perf(19 * 60, 20 * 60) }]);
    expect(ics).toContain('SUMMARY:Semi\\; colon\\, comma');
    // Folded continuation lines start with a single space.
    expect(ics).toMatch(/LOCATION:X+\r\n X+/);
  });
});
