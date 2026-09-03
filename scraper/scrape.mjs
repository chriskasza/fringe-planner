#!/usr/bin/env node
// Scrapes the Halifax Fringe 2026 schedule into show_times.json, plus each
// show's credits/rating/content-warnings and venue addresses into
// shows_meta.json and venues.json.
//
// Re-runnable: merges into the existing show_times.json rather than overwriting it.
// Nothing is ever deleted -- a showtime that disappears upstream is marked
// `cancelled` if it was still ahead of us and `ended` if it had already been
// played, so a pick can never vanish without a trace. shows_meta.json and
// venues.json follow the same rule: a show that drops off the pin board keeps
// its previously-scraped meta entry untouched rather than losing it.
//
//   node scraper/scrape.mjs

import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';

import {
  sleep,
  fail,
  slugify,
  byStart,
  stripLeadingThe,
  isCancelledTitle,
  cleanShowTitle,
  addMinutes,
  durationMinutes,
  halifaxStamp,
} from './lib/util.mjs';
import { scrapeCards, fetchShowData, resolveTimes, syntheticId } from './lib/simpletix.mjs';
import { fetchMeta } from './lib/meta.mjs';
import { createSummary, mergeShow, retireTime } from './lib/merge.mjs';

const TICKETS_URL = 'https://halifaxfringe.ca/home-copy-copy-3/';
const OUT = fileURLToPath(new URL('../src/data/show_times.json', import.meta.url));
const META_OUT = fileURLToPath(new URL('../src/data/shows_meta.json', import.meta.url));
const VENUES_OUT = fileURLToPath(new URL('../src/data/venues.json', import.meta.url));

// Low on purpose. This guard is here to catch the pin board's markup changing
// under us, which yields zero or a handful of cards -- it is not a census. The
// board legitimately shrinks as shows finish their run and the festival takes
// them down, and it was set to 50 against a board of 58, so it would have
// aborted every scrape from roughly mid-festival onward. The real protection
// against a parse change quietly mass-cancelling the file is
// MAX_UNEXPECTED_CANCELLED_SHOWS below, which counts shows that vanished while
// they still had performances ahead of them -- something a normal festival day
// never produces.
const MIN_EXPECTED_SHOWS = 10;
const MAX_UNEXPECTED_CANCELLED_SHOWS = 5;

const now = new Date().toISOString();
// "Now" as a naive Halifax stamp ("2026-09-02T22:56"), the same shape every
// `start`/`end` in the file already has, so the two compare as plain strings.
const nowLocal = halifaxStamp(now);

// Cosmetic abbreviations of the venues' own names, for tight grid rows. Not
// upstream data - purely a display shorthand, kept here so it's easy to spot
// and adjust without touching the scraper logic.
const SHORT_NAMES = {
  'Art Gallery of Nova Scotia': 'AGNS',
  'Bus Stop Theatre': 'Bus Stop',
  "Cruikshank's Halifax Funeral Home": "Cruikshank's",
  'DANSpace': 'DANSpace',
  'Grafton Street Dinner Theatre': 'Grafton Theatre',
  'Halifax Central Library': 'Central Library',
  'Halifax United Church': 'United Church',
  'inesS Circus': 'inesS',
  'Neptune Theatre Imperial Studio': 'Neptune Imperial',
  'Neptune Theatre Scotiabank Stage': 'Neptune Scotiabank',
  'Neptune Theatre Windsor Studio': 'Neptune Windsor',
  'Outdoor Walk - Meet at Library': 'Outdoor Walk',
  'Outdoors - Different Locations': 'Outdoors',
  'Point Pleasant Park - Black Rock Beach Picnic Area': 'Point Pleasant',
  'Sanctuary Arts Centre': 'Sanctuary Arts',
  'Stardust Bar': 'Stardust',
  'Universalist Unitarian Church of Halifax': 'Unitarian Church',
  'Wonderneath Art Society': 'Wonderneath',
};

// Narrower still, for the 66px mobile label column (see CLAUDE.md's 700px
// breakpoint): every space-separated token here is 8 characters or fewer, so
// it can't overflow whether it wraps or not. Only the venues whose SHORT_NAMES
// value contains a token too wide need an entry; the rest fall back to `short`
// in transform.ts. Lives here rather than only in the generated venues.json
// because this scraper rewrites each venue entry wholesale -- a curated value
// that exists only in the output file is deleted by the next run.
const SHORT_MOBILE_NAMES = {
  "Cruikshank's Halifax Funeral Home": "Cruik's",
  'Halifax Central Library': 'Central Lib',
  'Neptune Theatre Scotiabank Stage': 'Neptune Scotia',
  'Sanctuary Arts Centre': 'Sanctry Arts',
  'Universalist Unitarian Church of Halifax': 'Unitarn Church',
  'Wonderneath Art Society': 'Wonder',
};

// Upstream occasionally reports an end time that is plainly wrong, and a
// showtime's duration is load-bearing in the grid: blocks are positioned by
// pixel math off it, so one bad value stretches a whole day's axis and paints a
// block across every other show on it. There is no second source to fall back
// on -- the real length only exists as prose in the show's own blurb -- so the
// correction is curated here, next to SHORT_NAMES and for the same reason (the
// scraper rewrites the generated files wholesale, so a value that lived only in
// show_times.json would be deleted by the next run). Minutes, keyed by showId.
const DURATION_OVERRIDES = {
  // SimpleTix has dateEnd = dateStart + exactly 24h on all four nights
  // ("2026-09-03T23:00:00Z" -> "2026-09-04T23:00:00Z"); the show's own blurb
  // says "September 3rd, 4th, 10th, and 11th from 11:00 PM to 1:00 AM".
  // Verified against the embed API on 2026-08-31.
  291457: 120, // FREE - Late Night Cabaret
};

// The longest legitimate slot in this festival is the Kids Fringe drop-in
// (4h); everything that is actually a *performance* is 90 minutes or less.
// Past this, assume the upstream end time is wrong and say so, rather than
// quietly emitting a showtime that wrecks the day's grid.
const MAX_PLAUSIBLE_MINUTES = 360;

// --- main --------------------------------------------------------------

const cards = await scrapeCards();
console.log(`Found ${cards.length} show cards on the tickets page.`);
if (cards.length < MIN_EXPECTED_SHOWS) {
  fail(`only ${cards.length} shows parsed (expected >= ${MIN_EXPECTED_SHOWS}) -- the page markup probably changed`);
}

const isFirstRun = !existsSync(OUT);
const previous = isFirstRun ? { shows: [] } : JSON.parse(readFileSync(OUT, 'utf8'));
const prevShows = new Map((previous.shows ?? []).map((s) => [s.showId, s]));

const previousMeta = existsSync(META_OUT) ? JSON.parse(readFileSync(META_OUT, 'utf8')) : {};
const previousVenues = existsSync(VENUES_OUT) ? JSON.parse(readFileSync(VENUES_OUT, 'utf8')) : {};

const summary = createSummary();
const scraped = [];
const partialShows = [];
// Meta fetched successfully *this run*, keyed by showId. Anything not in here
// (a show cancelled off the pin board, or one whose meta-page fetch failed)
// falls back to previousMeta below -- never dropped, never re-fetched.
const freshMeta = {};
const venues = { ...previousVenues };
const failedMeta = [];
const pageTimeWarnings = [];
const implausibleTimes = [];

// Fills gaps in the date-wise fallback from the show page's JSON-LD. Only ever
// *adds* -- a slot the API knows and the page doesn't is kept, so this can't
// mass-cancel anything.
//
// The guard is the point. halifaxStamp converts a genuine UTC timestamp, while
// everything else upstream is naive local wall time (see util.mjs); getting
// that backwards would shift every added slot by three hours and look
// plausible. So before trusting the conversion, require the page's times to be
// a superset of the ones the API already gave us. If they aren't, the two
// sources disagree about more than completeness -- warn and add nothing.
function mergePageTimes(times, pageTimes, showId, venue) {
  if (!pageTimes.length) return { times, warning: null };

  const pageStarts = new Set(pageTimes.map((t) => t.start));
  const missing = times.filter((t) => !pageStarts.has(t.start));
  if (missing.length) {
    return {
      times,
      warning: `page times disagree with the API for ${showId} (API has ${missing
        .map((t) => t.start)
        .join(', ')}, page doesn't) -- ignoring the page`,
    };
  }

  const known = new Set(times.map((t) => t.start));
  const added = pageTimes
    .filter((t) => !known.has(t.start))
    .map((t) => ({ timeId: syntheticId(showId, t.start), start: t.start, end: t.end, venue }));

  return { times: [...times, ...added], warning: null };
}

for (const [i, card] of cards.entries()) {
  process.stdout.write(`  [${i + 1}/${cards.length}] ${card.title.slice(0, 50)}\r`);
  // A cancelled show has no performances, so don't ask resolveTimes for any.
  // Cancellation always coincides with the API dropping `eventTimes`, which
  // sends resolveTimes down its date-wise fallback -- and that path mints
  // fresh synthetic `s{showId}-{start}` ids for slots that no longer exist,
  // which the merge then writes out as brand-new *active* showtimes. Emitting
  // nothing instead lets the merge cancel every known time, which is the truth.
  const cancelled = isCancelledTitle(card.title);
  let data, salesEnded, times = [], partial = false;
  try {
    ({ data, salesEnded } = await fetchShowData(card.showId));
    if (!cancelled) ({ times, partial } = await resolveTimes(card.showId, data, salesEnded));
  } catch (err) {
    fail(`showtimes for "${card.title}" (${card.showId}): ${err.message}`);
  }

  // A show that has played its last performance can sit on the pin board a
  // while longer with an empty `eventTimes`. That is not a scrape failure, so
  // exempt it -- but only when every slot we already knew about has started, so
  // a genuinely empty response still aborts before it can wipe the file.
  // prevShows is not drained until the merge below, so it is still populated.
  if (!cancelled && !times.length) {
    const known = prevShows.get(card.showId)?.times ?? [];
    const finished = known.length > 0
      && known.every((t) => t.status !== 'active' || t.start <= nowLocal);
    if (!finished) fail(`"${card.title}" (${card.showId}) returned no showtimes`);
  }

  // No `eventTimes` means resolveTimes took the date-wise fallback, which is
  // the only path that can under-report. That's when the page's JSON-LD is
  // worth consulting -- see mergePageTimes below, applied once the meta fetch
  // has the page in hand.
  const usedFallback = !cancelled && !data.eventTimes?.length;

  // Strips the "FREE - ... (No Tickets Required, Just Show Up!)" decoration the
  // festival's own free events carry, which is the only place upstream records
  // that they're free. slugify below still gets the *raw* title -- the
  // SimpleTix URL contains the full decoration.
  const { title, freeAdmission } = cleanShowTitle(card.title || data.showTitle || '');

  const show = {
    showId: card.showId,
    title,
    blurb: card.blurb,
    poster: card.poster || data.imageUrl || '',
    venue: stripLeadingThe(data.venueTitle),
    ticketUrl: `https://www.simpletix.com/e/${slugify(card.title || data.showTitle)}-tickets-${card.showId}`,
    times: times.sort(byStart),
  };
  if (cancelled) show.cancelled = true;
  if (freeAdmission) show.freeAdmission = true;
  if (salesEnded) show.salesEnded = true;

  scraped.push(show);

  // A failed meta-page fetch is non-fatal: this show's fresh times still get
  // written, and its meta just falls back to previousMeta below.
  try {
    const { meta: showMeta, address, pageTimes } = await fetchMeta(show.showId, show.ticketUrl, show.title);

    // The page is already fetched here, so fill any fallback gap from its
    // JSON-LD rather than requesting the same HTML a second time.
    if (usedFallback && pageTimes.length) {
      const merged = mergePageTimes(show.times, pageTimes, show.showId, show.venue);
      if (merged.warning) {
        pageTimeWarnings.push(`${show.title} (${show.showId}): ${merged.warning}`);
      } else {
        show.times = merged.times.sort(byStart);
        // A second, independent source now agrees on the full list, so the
        // API's incompleteness is no longer something to warn about.
        partial = false;
      }
    }

    // A couple of shows have no venue in the API (the free roving outdoor
    // ones), but their own page's JSON-LD still names the place. Record it
    // so the front-end has something to show instead of a blank venue.
    if (!show.venue && address?.name) showMeta.venue = address.name;
    freshMeta[String(show.showId)] = showMeta;

    const venueName = show.venue || (address?.name ?? '');
    if (address && venueName) {
      const short = SHORT_NAMES[venueName] ?? venueName.toUpperCase();
      const shortMobile = SHORT_MOBILE_NAMES[venueName];
      venues[venueName] = {
        short,
        ...(shortMobile ? { shortMobile } : {}),
        shortAddress: address.shortAddress,
        fullAddress: address.fullAddress,
      };
    }
  } catch (err) {
    failedMeta.push(`${show.title} (${show.showId}): ${err.message}`);
  }

  // After the page merge, so a fallback slot recovered from the JSON-LD is
  // corrected too. Only `end` moves -- never `timeId`, so an override can't
  // cancel-and-re-add a showtime and orphan someone's pick.
  const overrideMins = DURATION_OVERRIDES[show.showId];
  if (overrideMins) {
    show.times = show.times.map((t) => ({ ...t, end: addMinutes(t.start, overrideMins) }));
  }

  for (const t of show.times) {
    const mins = durationMinutes(t.start, t.end);
    if (mins > MAX_PLAUSIBLE_MINUTES) {
      implausibleTimes.push(`${show.title} (${show.showId}): ${t.start} to ${t.end} -- ${mins} min`);
    }
  }

  // Decided after the meta fetch, since a page that filled the gap clears it.
  if (partial) {
    show.timesIncomplete = true;
    partialShows.push(`${card.title} (${card.showId})`);
  }

  await sleep(200);
}
process.stdout.write('\n');

const shows = [];
for (const s of scraped) {
  shows.push(mergeShow(prevShows.get(s.showId), s, now, nowLocal, summary));
  prevShows.delete(s.showId);
}

// Whatever is left dropped off the pin board entirely. Retire its showtimes the
// same way mergeShow retires individual ones -- this loop used to spread
// `...stale` untouched, which is how the Halifax Fringe Sampler ended up a
// "cancelled" show still wrapping an *active* showtime.
for (const stale of prevShows.values()) {
  if (stale.status !== 'active') {
    shows.push(stale);
    continue;
  }
  shows.push({ ...stale, times: (stale.times ?? []).map((t) => retireTime(t, nowLocal, now)) });
}

// One pass, so it covers both the shows delisted above and a show still on the
// board whose last performance has been played. A show is done when nothing
// active is left and at least one of its performances has actually started;
// anything else that lost its performances was cancelled. A show flagged
// `cancelled: true` upstream keeps its own status and UI -- it isn't ours to
// reclassify.
for (const show of shows) {
  if (show.status !== 'active' || show.cancelled) continue;
  const times = show.times ?? [];
  if (!times.length || times.some((t) => t.status === 'active')) continue;
  const played = times.some((t) => t.start <= nowLocal);
  show.status = played ? 'ended' : 'cancelled';
  show[played ? 'endedAt' : 'cancelledAt'] = now;
  (played ? summary.endedShows : summary.cancelledShows).push(show.title);
}

// A pin board that changed shape would delist shows that still have unplayed
// performances; a normal festival day only ever delists finished ones. Bail
// before writing rather than committing a mass cancellation.
if (summary.cancelledShows.length > MAX_UNEXPECTED_CANCELLED_SHOWS) {
  fail(
    `${summary.cancelledShows.length} shows vanished upstream with performances still ahead of them `
    + `(max ${MAX_UNEXPECTED_CANCELLED_SHOWS}) -- the page markup probably changed. Nothing written.`,
  );
}

shows.sort((a, b) => a.title.localeCompare(b.title) || a.showId - b.showId);

const out = {
  scrapedAt: now,
  timezone: 'America/Halifax',
  source: TICKETS_URL,
  shows,
};

// Build the final meta object from the *merged* shows list (active +
// carried-forward cancelled), not from `cards` / `scraped` -- otherwise a
// show that vanished from this run's pin board would silently lose its meta
// entry, breaking the same never-delete rule show_times.json follows.
const meta = {};
for (const s of shows) {
  const id = String(s.showId);
  if (Object.hasOwn(freshMeta, id)) meta[id] = freshMeta[id];
  else if (previousMeta[id]) meta[id] = previousMeta[id];
}

mkdirSync(fileURLToPath(new URL('../src/data', import.meta.url)), { recursive: true });

for (const [file, data] of [[OUT, out], [META_OUT, meta], [VENUES_OUT, venues]]) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file);
}

// --- report --------------------------------------------------------------

const timeCount = shows.reduce((n, s) => n + s.times.length, 0);
const activeTimes = shows.reduce((n, s) => n + s.times.filter((t) => t.status === 'active').length, 0);
console.log(`\nWrote show_times.json: ${shows.length} shows, ${timeCount} showtimes (${activeTimes} active).`);
console.log(`Wrote shows_meta.json: ${Object.keys(meta).length} shows.`);
console.log(`Wrote venues.json: ${Object.keys(venues).length} venues.`);

const report = [
  ['new shows', summary.newShows],
  ['cancelled shows', summary.cancelledShows],
  ['ended shows', summary.endedShows],
  ['new showtimes', summary.newTimes],
  ['cancelled showtimes', summary.cancelledTimes],
  ['ended showtimes', summary.endedTimes],
  ['revived showtimes', summary.revived],
  ['rescheduled', summary.changed],
].filter(([, items]) => items.length);

if (isFirstRun) {
  // Everything is "new" on a first run; listing all 289 lines is just noise.
  console.log('Initial scrape -- no previous show_times.json to compare against.');
} else if (!report.length) {
  console.log('No changes since the last run.');
} else {
  for (const [label, items] of report) {
    console.log(`\n${items.length} ${label}:`);
    for (const item of items) console.log(`  - ${item}`);
  }
}

if (failedMeta.length) {
  console.log(`\n${failedMeta.length} show(s) failed to fetch meta (kept previous data if available):`);
  for (const f of failedMeta) console.log(`  - ${f}`);
}

if (pageTimeWarnings.length) {
  console.log(`\nWARNING -- ${pageTimeWarnings.length} show(s) whose page times contradict the API:`);
  for (const w of pageTimeWarnings) console.log(`  - ${w}`);
  console.log('  Nothing was added from the page. Check whether the JSON-LD timezone changed.');
}

if (implausibleTimes.length) {
  console.log(
    `\nWARNING -- ${implausibleTimes.length} showtime(s) longer than ${MAX_PLAUSIBLE_MINUTES} min:`,
  );
  for (const t of implausibleTimes) console.log(`  - ${t}`);
  console.log(
    '  Upstream end times are probably wrong. Check the show\'s blurb for the real',
  );
  console.log('  length and add it to DURATION_OVERRIDES -- a block this wide breaks the grid.');
}

const noRating = Object.entries(meta).filter(([, m]) => m.rating === 'NOT RATED');
if (noRating.length) {
  console.log(`\n${noRating.length} show(s) had no parsed rating (defaulted to NOT RATED):`);
  for (const [id] of noRating) {
    const s = shows.find((x) => String(x.showId) === id);
    console.log(`  - ${s?.title ?? id} (${id})`);
  }
}

const noDescription = Object.entries(meta).filter(([, m]) => !m.description?.length);
if (noDescription.length) {
  console.log(`\n${noDescription.length} show(s) had no parsed description:`);
  for (const [id] of noDescription) {
    const s = shows.find((x) => String(x.showId) === id);
    console.log(`  - ${s?.title ?? id} (${id})`);
  }
}

if (partialShows.length) {
  console.log(`\nWARNING -- ticket sales ended, showtimes may be incomplete (flagged "timesIncomplete"):`);
  for (const s of partialShows) console.log(`  - ${s}`);
  console.log('  Check the SimpleTix page for these; the API no longer lists every performance.');
}
