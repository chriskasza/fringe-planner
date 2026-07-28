#!/usr/bin/env node
// Scrapes the Halifax Fringe 2026 schedule into show_times.json, plus each
// show's credits/rating/content-warnings and venue addresses into
// shows_meta.json and venues.json.
//
// Re-runnable: merges into the existing show_times.json rather than overwriting it.
// Nothing is ever deleted -- showtimes that disappear upstream are marked
// cancelled so the app can render them struck through. shows_meta.json and
// venues.json follow the same rule: a show that drops off the pin board keeps
// its previously-scraped meta entry untouched rather than losing it.
//
//   node scraper/scrape.mjs

import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';

import { sleep, fail, slugify, byStart } from './lib/util.mjs';
import { scrapeCards, fetchShowData, resolveTimes } from './lib/simpletix.mjs';
import { fetchMeta } from './lib/meta.mjs';
import { createSummary, mergeShow } from './lib/merge.mjs';

const TICKETS_URL = 'https://halifaxfringe.ca/home-copy-copy-3/';
const OUT = fileURLToPath(new URL('../src/data/show_times.json', import.meta.url));
const META_OUT = fileURLToPath(new URL('../src/data/shows_meta.json', import.meta.url));
const VENUES_OUT = fileURLToPath(new URL('../src/data/venues.json', import.meta.url));

const MIN_EXPECTED_SHOWS = 50;

const now = new Date().toISOString();

// Cosmetic abbreviations of the venues' own names, for tight grid rows. Not
// upstream data - purely a display shorthand, kept here so it's easy to spot
// and adjust without touching the scraper logic.
const SHORT_NAMES = {
  'Bus Stop Theatre': 'BUS STOP',
  "Cruikshank's Halifax Funeral Home": 'CRUIKSHANK’S',
  DANSpace: 'DANSPACE',
  'Grafton Street Dinner Theatre': 'GRAFTON ST',
  'Halifax United Church': 'UNITED CHURCH',
  'Neptune Theatre Imperial Studio': 'NEPTUNE IMPERIAL',
  'Neptune Theatre Scotiabank Stage': 'NEPTUNE SCOTIABANK',
  'Neptune Theatre Windsor Studio': 'NEPTUNE WINDSOR',
  'Outdoor Walk - Meet at Library': 'OUTDOOR WALK',
  'Point Pleasant Park - Black Rock Beach Picnic Area': 'POINT PLEASANT PARK',
  'Sanctuary Arts Centre': 'SANCTUARY ARTS',
  'Stardust Bar': 'STARDUST BAR',
  'The Art Gallery of Nova Scotia': 'AGNS',
  'Universalist Unitarian Church of Halifax': 'UNITARIAN CHURCH',
  'Wonderneath Art Society': 'WONDERNEATH',
  'inesS Circus': 'INESS CIRCUS',
  'Outdoors - Different Locations': 'OUTDOORS',
};

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

for (const [i, card] of cards.entries()) {
  process.stdout.write(`  [${i + 1}/${cards.length}] ${card.title.slice(0, 50)}\r`);
  let data, salesEnded, times, partial;
  try {
    ({ data, salesEnded } = await fetchShowData(card.showId));
    ({ times, partial } = await resolveTimes(card.showId, data, salesEnded));
  } catch (err) {
    fail(`showtimes for "${card.title}" (${card.showId}): ${err.message}`);
  }

  if (!times.length) fail(`"${card.title}" (${card.showId}) returned no showtimes`);
  if (partial) partialShows.push(`${card.title} (${card.showId})`);

  const show = {
    showId: card.showId,
    title: card.title || data.showTitle || '',
    blurb: card.blurb,
    poster: card.poster || data.imageUrl || '',
    venue: data.venueTitle ?? '',
    ticketUrl: `https://www.simpletix.com/e/${slugify(card.title || data.showTitle)}-tickets-${card.showId}`,
    times: times.sort(byStart),
  };
  if (salesEnded) show.salesEnded = true;
  if (partial) show.timesIncomplete = true;

  scraped.push(show);

  // A failed meta-page fetch is non-fatal: this show's fresh times still get
  // written, and its meta just falls back to previousMeta below.
  try {
    const { meta: showMeta, address } = await fetchMeta(show.showId, show.ticketUrl, show.title);

    // A couple of shows have no venue in the API (the free roving outdoor
    // ones), but their own page's JSON-LD still names the place. Record it
    // so the front-end has something to show instead of a blank venue.
    if (!show.venue && address?.name) showMeta.venue = address.name;
    freshMeta[String(show.showId)] = showMeta;

    const venueName = show.venue || (address?.name ?? '');
    if (address && venueName) {
      const short = SHORT_NAMES[venueName] ?? venueName.toUpperCase();
      venues[venueName] = {
        short,
        shortAddress: address.shortAddress,
        fullAddress: address.fullAddress,
      };
    }
  } catch (err) {
    failedMeta.push(`${show.title} (${show.showId}): ${err.message}`);
  }

  await sleep(200);
}
process.stdout.write('\n');

const shows = [];
for (const s of scraped) {
  shows.push(mergeShow(prevShows.get(s.showId), s, now, summary));
  prevShows.delete(s.showId);
}
for (const stale of prevShows.values()) {
  if (stale.status !== 'cancelled') summary.cancelledShows.push(stale.title);
  shows.push({ ...stale, status: 'cancelled', cancelledAt: stale.cancelledAt ?? now });
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
  ['new showtimes', summary.newTimes],
  ['cancelled showtimes', summary.cancelledTimes],
  ['revived showtimes', summary.revived],
  ['rescheduled', summary.changed],
].filter(([, items]) => items.length);

if (isFirstRun) {
  // Everything is "new" on a first run; listing all 282 lines is just noise.
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

const noRating = Object.entries(meta).filter(([, m]) => m.rating === 'NOT RATED');
if (noRating.length) {
  console.log(`\n${noRating.length} show(s) had no parsed rating (defaulted to NOT RATED):`);
  for (const [id] of noRating) {
    const s = shows.find((x) => String(x.showId) === id);
    console.log(`  - ${s?.title ?? id} (${id})`);
  }
}

if (partialShows.length) {
  console.log(`\nWARNING -- ticket sales ended, showtimes may be incomplete (flagged "timesIncomplete"):`);
  for (const s of partialShows) console.log(`  - ${s}`);
  console.log('  Check the SimpleTix page for these; the API no longer lists every performance.');
}
