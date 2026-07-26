import type {
  DayKey,
  Perf,
  Show,
  ShowsMetaFile,
  ShowTimesFile,
  VenuesFile,
} from './types';
import { buildFestivalDays, minutesFromMidnight, splitNaiveTimestamp } from './dates';

function transformPerf(showId: string, raw: ShowTimesFile['shows'][number]['times'][number]): Perf {
  const startStamp = splitNaiveTimestamp(raw.start);
  const endStamp = splitNaiveTimestamp(raw.end);
  const start = minutesFromMidnight(startStamp.hh, startStamp.mm);
  let end = minutesFromMidnight(endStamp.hh, endStamp.mm);
  if (endStamp.date !== startStamp.date) end += 1440; // crosses midnight, rare but keep ordering sane

  return {
    timeId: raw.timeId,
    showId,
    day: startStamp.date,
    start,
    end,
    mins: Math.max(0, end - start),
    status: raw.status,
  };
}

function transformShow(
  raw: ShowTimesFile['shows'][number],
  meta: ShowsMetaFile,
  venues: VenuesFile,
): Show {
  const id = String(raw.showId);
  const showMeta = meta[id];
  const venueMeta = venues[raw.venue];

  const perfs = raw.times
    .map((t) => transformPerf(id, t))
    .sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);

  const firstActive = perfs.find((p) => p.status === 'active') ?? perfs[0];

  // The API leaves `venue` empty for the roving outdoor shows; scrape_meta
  // recovers the name from the show page's JSON-LD. Falling back here keeps
  // a blank row out of the Venue filter and a blank line off the card.
  const venue = raw.venue || showMeta?.venue || 'Venue TBA';
  const resolvedVenueMeta = venues[venue] ?? venueMeta;

  return {
    id,
    title: raw.title,
    blurb: raw.blurb,
    poster: raw.poster,
    ticketUrl: raw.ticketUrl,
    venue,
    venueShort: resolvedVenueMeta?.short ?? venue.toUpperCase(),
    venueAddress: resolvedVenueMeta?.shortAddress ?? null,
    credits: showMeta?.credits ?? [],
    rating: showMeta?.rating ?? 'NOT RATED',
    warnings: showMeta?.warnings ?? [],
    mins: firstActive?.mins ?? 0,
    salesEnded: raw.salesEnded ?? false,
    timesIncomplete: raw.timesIncomplete ?? false,
    perfs,
  };
}

export function transform(
  showTimes: ShowTimesFile,
  meta: ShowsMetaFile,
  venues: VenuesFile,
): { shows: Show[]; days: ReturnType<typeof buildFestivalDays> } {
  const shows = showTimes.shows
    .filter((s) => s.status === 'active')
    .map((s) => transformShow(s, meta, venues));

  const counts: Record<DayKey, number> = {};
  for (const show of shows) {
    for (const perf of show.perfs) {
      if (perf.status !== 'active') continue;
      counts[perf.day] = (counts[perf.day] ?? 0) + 1;
    }
  }

  return { shows, days: buildFestivalDays(counts) };
}
