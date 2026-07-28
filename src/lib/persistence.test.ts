import { describe, expect, it } from 'vitest';
import { decodePicked, encodePicked, parseRestoreInput } from './persistence';
import { perfKey } from './derived';
import { shows as realShows } from './loadData';
import type { Perf, PerfKey, Show } from './types';

function perf(timeId: number | string, day: string, start: number, status: Perf['status'] = 'active'): Perf {
  return { timeId: String(timeId), showId: '284247', day, start, end: start + 60, mins: 60, status };
}

function showWith(perfs: Perf[], id = '284247'): Show {
  return {
    id,
    title: 'A Show',
    blurb: '',
    poster: '',
    ticketUrl: '',
    venue: 'The Bus Stop Theatre',
    venueShort: 'BUS STOP',
    venueAddress: null,
    credits: [],
    rating: 'PG',
    warnings: [],
    mins: 60,
    salesEnded: false,
    timesIncomplete: false,
    perfs: perfs.map((p) => ({ ...p, showId: id })),
  };
}

const keysOf = (set: Set<PerfKey>) => [...set].sort();

describe('encodePicked / decodePicked', () => {
  it('round-trips a set of picks', () => {
    const show = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1020), perf(103, '2026-09-04', 1170)]);
    const picked = new Set([perfKey('284247', '2026-09-03', 840), perfKey('284247', '2026-09-04', 1170)]);

    const encoded = encodePicked(picked, [show]);
    expect(encoded).toBe('101.103');
    expect(keysOf(decodePicked(encoded, [show]))).toEqual(keysOf(picked));
  });

  it('is order-independent, so the same schedule always produces the same link', () => {
    const show = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1020)]);
    const a = new Set([perfKey('284247', '2026-09-03', 840), perfKey('284247', '2026-09-03', 1020)]);
    const b = new Set([perfKey('284247', '2026-09-03', 1020), perfKey('284247', '2026-09-03', 840)]);
    expect(encodePicked(a, [show])).toBe(encodePicked(b, [show]));
  });

  // The whole point of keying on timeId. The scraper marks a vanished
  // showtime `cancelled` instead of deleting it, but it still leaves the
  // active list, so position-based tokens shifted every later pick onto the
  // wrong performance - silently, with no error the user could see.
  it('still resolves to the same performance after an earlier one is cancelled', () => {
    const before = showWith([
      perf(101, '2026-09-03', 840),
      perf(102, '2026-09-03', 1020),
      perf(103, '2026-09-04', 1170),
      perf(104, '2026-09-05', 1170),
    ]);
    const picked = new Set([perfKey('284247', '2026-09-05', 1170)]);
    const encoded = encodePicked(picked, [before]);

    const after = showWith([
      perf(101, '2026-09-03', 840),
      perf(102, '2026-09-03', 1020, 'cancelled'),
      perf(103, '2026-09-04', 1170),
      perf(104, '2026-09-05', 1170),
    ]);
    expect(keysOf(decodePicked(encoded, [after]))).toEqual(keysOf(picked));
  });

  it('survives a performance being rescheduled to a different time', () => {
    const before = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1020)]);
    const encoded = encodePicked(new Set([perfKey('284247', '2026-09-03', 1020)]), [before]);

    const after = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1140)]);
    expect(keysOf(decodePicked(encoded, [after]))).toEqual([perfKey('284247', '2026-09-03', 1140)]);
  });

  it('drops a pick whose performance has been cancelled outright', () => {
    const before = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1020)]);
    const encoded = encodePicked(
      new Set([perfKey('284247', '2026-09-03', 840), perfKey('284247', '2026-09-03', 1020)]),
      [before],
    );

    const after = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1020, 'cancelled')]);
    expect(keysOf(decodePicked(encoded, [after]))).toEqual([perfKey('284247', '2026-09-03', 840)]);
  });

  it('handles the synthetic string timeIds the scraper mints for some shows', () => {
    const show = showWith([perf('s284082-2026-09-04T17:45', '2026-09-04', 1065)], '284082');
    const picked = new Set([perfKey('284082', '2026-09-04', 1065)]);
    const encoded = encodePicked(picked, [show]);
    expect(encoded).toBe('s284082-2026-09-04T17:45');
    expect(encodeURIComponent(encoded)).toBe(encoded.replace(/:/g, '%3A')); // fragment-safe apart from ':'
    expect(keysOf(decodePicked(encoded, [show]))).toEqual(keysOf(picked));
  });

  it('skips junk tokens individually instead of losing the whole schedule', () => {
    const show = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1020)]);
    expect(keysOf(decodePicked('101.nonsense.999999.102', [show]))).toEqual(
      keysOf(new Set([perfKey('284247', '2026-09-03', 840), perfKey('284247', '2026-09-03', 1020)])),
    );
    expect(decodePicked('', [show]).size).toBe(0);
    expect(decodePicked('....', [show]).size).toBe(0);
  });

  it('skips picks for shows that are no longer in the data', () => {
    const show = showWith([perf(101, '2026-09-03', 840)]);
    const picked = new Set([perfKey('999999', '2026-09-03', 840)]);
    expect(encodePicked(picked, [show])).toBe('');
  });

  it('round-trips against the real festival data', () => {
    // timeIds are unique festival-wide, which is what lets a token carry no
    // show id; if a re-scrape ever breaks that, this fails loudly.
    const ids = realShows.flatMap((s) => s.perfs.map((p) => String(p.timeId)));
    expect(new Set(ids).size).toBe(ids.length);

    const picked = new Set(
      realShows.slice(0, 12).map((s) => {
        const p = s.perfs.find((x) => x.status === 'active') ?? s.perfs[0];
        return perfKey(s.id, p.day, p.start);
      }),
    );
    expect(keysOf(decodePicked(encodePicked(picked, realShows), realShows))).toEqual(keysOf(picked));
  });
});

// The Sync sheet offers two ways back in - "paste a schedule link" and "drop
// a .json backup" - and neither is the bare token string decodePicked takes.
// Both used to be handed straight to it, so both always failed with "No valid
// picks found in that link or file."
describe('parseRestoreInput', () => {
  const show = showWith([perf(101, '2026-09-03', 840), perf(102, '2026-09-03', 1020)]);
  const both = [perfKey('284247', '2026-09-03', 840), perfKey('284247', '2026-09-03', 1020)].sort();

  it('accepts a pasted schedule link', () => {
    expect(keysOf(parseRestoreInput('https://example.test/fringe/#p=101.102', [show]))).toEqual(both);
  });

  it('accepts a link with surrounding whitespace, a percent-encoded token, and a query string', () => {
    const synthetic = showWith([perf('s284082-2026-09-04T17:45', '2026-09-04', 1065)], '284082');
    expect(
      keysOf(parseRestoreInput('  https://example.test/#p=s284082-2026-09-04T17%3A45\n', [synthetic])),
    ).toEqual([perfKey('284082', '2026-09-04', 1065)]);
    expect(keysOf(parseRestoreInput('https://example.test/?p=101#p=101.102', [show]))).toEqual(both);
  });

  it('still accepts a bare token string', () => {
    expect(keysOf(parseRestoreInput('101.102', [show]))).toEqual(both);
  });

  it('accepts the .json backup the sheet itself writes', () => {
    const backup = JSON.stringify([
      { timeId: 101, title: 'A Show', venue: 'The Bus Stop Theatre', day: '2026-09-03', start: 840, mins: 60 },
      { timeId: 102, title: 'A Show', venue: 'The Bus Stop Theatre', day: '2026-09-03', start: 1020, mins: 60 },
    ]);
    expect(keysOf(parseRestoreInput(backup, [show]))).toEqual(both);
  });

  it('falls back to title + day + start for a backup written without timeIds', () => {
    const backup = JSON.stringify([{ title: 'A Show', day: '2026-09-03', start: 1020 }]);
    expect(keysOf(parseRestoreInput(backup, [show]))).toEqual([perfKey('284247', '2026-09-03', 1020)]);
  });

  it('returns nothing for empty, malformed, or unrecognised input', () => {
    expect(parseRestoreInput('', [show]).size).toBe(0);
    expect(parseRestoreInput('   ', [show]).size).toBe(0);
    expect(parseRestoreInput('[{"timeId":', [show]).size).toBe(0); // truncated JSON
    expect(parseRestoreInput('[1, null, "x"]', [show]).size).toBe(0);
    expect(parseRestoreInput('https://example.test/fringe/', [show]).size).toBe(0);
    expect(parseRestoreInput('68abcA.68abcC', [show]).size).toBe(0); // old index-format link
  });

  it('round-trips a share link built the way the Sync sheet builds it', () => {
    const picked = new Set([perfKey('284247', '2026-09-03', 1020)]);
    const link = `https://example.test/fringe/#p=${encodePicked(picked, [show])}`;
    expect(keysOf(parseRestoreInput(link, [show]))).toEqual(keysOf(picked));
  });
});
