import { describe, expect, it } from 'vitest';
import { transform } from './transform';
import type { ShowsMetaFile, ShowTimesFile, VenuesFile } from './types';

const showTimes: ShowTimesFile = {
  scrapedAt: '2026-08-08T00:00:00.000Z',
  timezone: 'America/Halifax',
  source: 'https://halifaxfringe.ca/',
  shows: [
    {
      showId: 1,
      title: 'APPLES!',
      blurb: 'A truncated teaser',
      poster: '',
      venue: 'Bus Stop Theatre',
      ticketUrl: '',
      status: 'active',
      firstSeen: '2026-08-08T00:00:00.000Z',
      times: [
        {
          timeId: 10,
          start: '2026-09-03T14:00',
          end: '2026-09-03T15:00',
          venue: 'Bus Stop Theatre',
          status: 'active',
          firstSeen: '2026-08-08T00:00:00.000Z',
        },
      ],
    },
  ],
};

const venues: VenuesFile = {
  'Bus Stop Theatre': { short: 'BUS STOP', shortAddress: null, fullAddress: null },
};

function transformWith(meta: ShowsMetaFile) {
  return transform(showTimes, meta, venues).shows[0];
}

describe('transform - description', () => {
  it('carries the scraped paragraphs through', () => {
    const show = transformWith({
      '1': { description: ['First.', 'Second.'], credits: [], rating: 'PG', warnings: [], warningTags: [] },
    });
    expect(show.description).toEqual(['First.', 'Second.']);
    expect(show.blurb).toBe('A truncated teaser');
  });

  // shows_meta.json entries are carried forward untouched when a show's
  // meta-page fetch fails (see scraper/scrape.mjs), so an entry written before
  // `description` existed has to transform into an empty array, not undefined -
  // DetailPanel reads `.length` on it.
  it('defaults to an empty array when the meta entry predates the field', () => {
    const show = transformWith({
      '1': { credits: [], rating: 'PG', warnings: [], warningTags: [] },
    });
    expect(show.description).toEqual([]);
  });

  it('defaults to an empty array when the show has no meta entry at all', () => {
    expect(transformWith({}).description).toEqual([]);
  });
});

// A cancelled show stays on the pin board, so its `status` is still 'active'
// (that field only tracks whether upstream still lists it). What marks it is
// the `cancelled` flag, and every one of its times is cancelled - which is why
// `mins` has to survive off a cancelled perf.
describe('transform - cancelled shows', () => {
  const cancelledFile: ShowTimesFile = {
    ...showTimes,
    shows: [
      {
        ...showTimes.shows[0],
        cancelled: true,
        times: showTimes.shows[0].times.map((t) => ({ ...t, status: 'cancelled' as const })),
      },
    ],
  };
  const meta: ShowsMetaFile = { '1': { credits: [], rating: 'PG', warnings: [], warningTags: [] } };

  it('keeps the show, flags it, and leaves it with no active performances', () => {
    const show = transform(cancelledFile, meta, venues).shows[0];
    expect(show.cancelled).toBe(true);
    expect(show.perfs.every((p) => p.status === 'cancelled')).toBe(true);
    expect(show.mins).toBe(60); // read off the cancelled perf, not zeroed
  });

  it('defaults the flag to false for a show the scraper never marked', () => {
    expect(transform(showTimes, meta, venues).shows[0].cancelled).toBe(false);
  });

  it('leaves its cancelled performances out of the per-day counts', () => {
    expect(transform(cancelledFile, meta, venues).days.find((d) => d.key === '2026-09-03')?.count).toBe(0);
    expect(transform(showTimes, meta, venues).days.find((d) => d.key === '2026-09-03')?.count).toBe(1);
  });
});
