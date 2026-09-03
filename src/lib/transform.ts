import type {
  DayKey,
  Perf,
  Show,
  ShowsMetaFile,
  ShowTimesFile,
  VenuesFile,
} from './types';
import { buildFestivalDays, minutesFromMidnight, splitNaiveTimestamp } from './dates';
import { notCancelled } from './derived';

function transformPerf(showId: string, raw: ShowTimesFile['shows'][number]['times'][number]): Perf {
  const startStamp = splitNaiveTimestamp(raw.start);
  const endStamp = splitNaiveTimestamp(raw.end);
  const start = minutesFromMidnight(startStamp.hh, startStamp.mm);
  let end = minutesFromMidnight(endStamp.hh, endStamp.mm);
  if (endStamp.date !== startStamp.date) end += 1440; // crosses midnight, rare but keep ordering sane

  return {
    timeId: String(raw.timeId),
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

  // Drives `show.mins`, the duration shown before you open anything. Prefer a
  // performance still on sale; a fully-played show falls back to its own
  // history rather than reporting 0.
  const firstActive = perfs.find((p) => p.status === 'active') ?? perfs.find(notCancelled) ?? perfs[0];

  // The API leaves `venue` empty for the roving outdoor shows; the scraper
  // recovers the name from the show page's JSON-LD. Falling back here keeps
  // a blank row out of the Venue filter and a blank line off the card.
  const venue = raw.venue || showMeta?.venue || 'Venue TBA';
  const resolvedVenueMeta = venues[venue] ?? venueMeta;

  return {
    id,
    title: raw.title,
    blurb: raw.blurb,
    description: showMeta?.description ?? [],
    poster: raw.poster,
    ticketUrl: raw.ticketUrl,
    venue,
    venueShort: resolvedVenueMeta?.short ?? venue.toUpperCase(),
    venueShortMobile: resolvedVenueMeta?.shortMobile ?? resolvedVenueMeta?.short ?? venue.toUpperCase(),
    venueAddress: resolvedVenueMeta?.shortAddress ?? null,
    credits: showMeta?.credits ?? [],
    rating: showMeta?.rating ?? 'NOT RATED',
    warnings: showMeta?.warnings ?? [],
    warningTags: showMeta?.warningTags ?? [],
    mins: firstActive?.mins ?? 0,
    cancelled: raw.cancelled ?? false,
    freeAdmission: raw.freeAdmission ?? false,
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
  // Keeps `ended` shows, drops `cancelled` ones. A show whose whole run has
  // been played is history, not a mistake: filtering it out here removed it
  // from `perfIndex` too, so `pickedList` could no longer resolve a pick on
  // it and the entry disappeared from My Fringe, the ICS export and shared
  // links without a trace. A cancelled show never happened and has no
  // history to keep.
  const shows = showTimes.shows
    .filter((s) => s.status !== 'cancelled')
    .map((s) => transformShow(s, meta, venues));

  const counts: Record<DayKey, number> = {};
  // Played performances count, so a finished day keeps a non-zero count and
  // stays on the day strip with its history on it. The landing-day rule in
  // `createInitialState` is what stops that pulling the grid backwards - it
  // only considers days from today forward.
  for (const show of shows) {
    for (const perf of show.perfs) {
      if (!notCancelled(perf)) continue;
      counts[perf.day] = (counts[perf.day] ?? 0) + 1;
    }
  }

  return { shows, days: buildFestivalDays(counts) };
}
