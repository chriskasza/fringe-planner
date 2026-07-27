#!/usr/bin/env node
// Scrapes the Halifax Fringe 2026 schedule into show_times.json.
//
// Re-runnable: merges into the existing show_times.json rather than overwriting it.
// Nothing is ever deleted -- showtimes that disappear upstream are marked
// cancelled so the app can render them struck through.
//
//   node scrape.mjs

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';

const APP_ID = '1b63385b-47c1-46d8-a3ea-07a70e6f045f';

// The tickets page (halifaxfringe.ca/home-copy-copy-3/) renders its show cards
// client-side, so scraping that URL yields nothing. This is the endpoint its widget
// actually calls -- same card markup, served directly, no headers required.
//
// The server rejects limit > 100 with a 400, so 100 is the ceiling. The festival
// currently has 57 entries; if it ever grows past the limit we'd silently truncate,
// hence the check after parsing.
const PINBOARD_LIMIT = 100;
const PINBOARD_URL =
  'https://contact.simpletix.com/Calendar/GetPinBoard' +
  `?applicationId=${APP_ID}&searchText=&dateTime=&isLimitedEvent=true` +
  '&openEventPageType=0&isDisplayEventCategory=0&selectedEventCategories=' +
  `&limit=${PINBOARD_LIMIT}&affiliate=&activeTab=events`;

const TICKETS_URL = 'https://halifaxfringe.ca/home-copy-copy-3/';
const API_BASE = 'https://api.prod.simpletix.com/embed/Event';
const OUT = new URL('./src/data/show_times.json', import.meta.url).pathname;

// "Show Passes" is a bundle product, not a show.
const SKIP_SHOW_IDS = new Set([284273]);

const MIN_EXPECTED_SHOWS = 50;

const now = new Date().toISOString();

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', eacute: 'é',
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? m);
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function slugify(title) {
  return decodeEntities(title)
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// The API returns local Halifax wall time with a bogus trailing Z.
// "2026-09-03T14:00:00Z" is the 2:00 PM show, not 11:00 AM. Keep it naive.
function localStamp(s) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(s ?? '');
  if (!m) throw new Error(`unparseable timestamp: ${s}`);
  return `${m[1]}T${m[2]}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// timeId is numeric for normal showtimes and a synthetic string for the handful the
// API reports without one, so compare as strings.
const byStart = (a, b) =>
  a.start.localeCompare(b.start) || String(a.timeId).localeCompare(String(b.timeId));

function fail(msg) {
  console.error(`\n  FAILED: ${msg}`);
  console.error('  show_times.json was left untouched.\n');
  process.exit(1);
}

async function scrapeCards() {
  const res = await fetch(PINBOARD_URL);
  if (!res.ok) fail(`pin board returned ${res.status}`);
  const html = await res.text();

  const cards = [];
  for (const block of html.split('<div class="upc-card">').slice(1)) {
    const id = /data-showid="(\d+)"/.exec(block);
    if (!id) continue;
    const showId = Number(id[1]);
    if (SKIP_SHOW_IDS.has(showId)) continue;

    const title = /<h4>([\s\S]*?)<\/h4>/.exec(block);
    const poster = /background-image:url\('([^']+)'\)/.exec(block);
    // The blurb is the <p> inside .upc-content that follows the </ul> of showtimes.
    const blurb = /<\/ul>\s*<p>([\s\S]*?)<\/p>/.exec(block);

    cards.push({
      showId,
      title: title ? stripTags(title[1]) : '',
      poster: poster ? poster[1] : '',
      blurb: blurb ? stripTags(blurb[1]) : '',
    });
  }

  const total = (html.match(/<div class="upc-card">/g) ?? []).length;
  if (total >= PINBOARD_LIMIT) {
    fail(`pin board returned ${total} cards, at or above the limit of ${PINBOARD_LIMIT} -- the list is probably truncated`);
  }

  return cards;
}

const HEADERS = {
  application: APP_ID,
  isBoxOffice: '0',
  originType: '9',
  Accept: 'application/json',
};

async function api(endpoint, showId) {
  const res = await fetch(`${API_BASE}/${endpoint}/${showId}`, { headers: HEADERS });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`HTTP ${res.status}, unparseable body`);
  return { status: res.status, json };
}

async function fetchShowData(showId) {
  // A 406 "Tickets Sales Ended" still carries usable metadata, so don't treat
  // non-2xx as fatal here -- decide based on what the payload actually contains.
  const { status, json } = await api('GetMultiTimeSelectionData', showId);
  if (!json.data) {
    throw new Error(json.errorMessages?.join('; ') || `HTTP ${status}, no data`);
  }
  return { data: json.data, salesEnded: !json.isSuccessful };
}

// One entry per *date* (not per showtime), but it keeps working when
// GetMultiTimeSelectionData has stopped returning eventTimes.
async function fetchDateWise(showId) {
  try {
    const { json } = await api('GetDataDateWiseList', showId);
    return json.data?.eventData ?? [];
  } catch {
    return [];
  }
}

// Synthetic key for showtimes the API gives us without a timeId. Stable across runs
// as long as the start time doesn't move, which is all the app's starring needs.
const syntheticId = (showId, start) => `s${showId}-${start}`;

async function resolveTimes(showId, data, salesEnded) {
  const venue = data.venueTitle ?? '';

  // Normal case: a real eventTimes array with real timeIds.
  if (data.eventTimes?.length) {
    return {
      times: data.eventTimes.map((t) => ({
        timeId: t.timeId,
        start: localStamp(t.dateStart),
        end: localStamp(t.dateEnd),
        venue: t.venueTitle || venue,
      })),
      partial: false,
    };
  }

  // Single-performance shows leave eventTimes null and put the one slot at the
  // top level (e.g. "Metal Box", "Whose Presentation Is It Anyway?").
  // Sales-ended shows also land here, where the date-wise list is all we get.
  const byStart = new Map();
  const add = (startRaw, endRaw) => {
    if (!startRaw) return;
    const start = localStamp(startRaw);
    if (byStart.has(start)) return;
    byStart.set(start, {
      timeId: syntheticId(showId, start),
      start,
      end: endRaw ? localStamp(endRaw) : start,
      venue,
    });
  };

  add(data.showStartDate, data.showEndDate);
  for (const d of await fetchDateWise(showId)) add(d.dateStart, d.dateEnd);

  const times = [...byStart.values()];

  // For a sales-ended show the API is demonstrably incomplete -- "Game of drones"
  // lists three performances on its public page but the API knows of two. Keep what
  // we have, but flag it so the listing isn't quietly wrong.
  return { times, partial: salesEnded };
}

// --- merge -----------------------------------------------------------------

const summary = { newShows: [], cancelledShows: [], newTimes: [], cancelledTimes: [], revived: [], changed: [] };

function mergeTime(prev, next, showTitle) {
  if (!prev) {
    summary.newTimes.push(`${showTitle} @ ${next.start}`);
    return { ...next, status: 'active', firstSeen: now };
  }

  const merged = { ...prev, ...next, status: 'active', firstSeen: prev.firstSeen ?? now };

  if (prev.status === 'cancelled') {
    delete merged.cancelledAt;
    summary.revived.push(`${showTitle} @ ${next.start}`);
  }

  const changes = [...(prev.changes ?? [])];
  for (const field of ['start', 'end', 'venue']) {
    if (prev[field] !== undefined && prev[field] !== next[field]) {
      changes.push({ at: now, field, from: prev[field], to: next[field] });
      summary.changed.push(`${showTitle}: ${field} ${prev[field]} -> ${next[field]}`);
    }
  }
  if (changes.length) merged.changes = changes;

  return merged;
}

function mergeShow(prev, next) {
  if (!prev) {
    summary.newShows.push(next.title);
    return {
      ...next,
      status: 'active',
      firstSeen: now,
      times: next.times.map((t) => mergeTime(null, t, next.title)),
    };
  }

  const prevTimes = new Map((prev.times ?? []).map((t) => [t.timeId, t]));
  const times = [];

  for (const t of next.times) {
    times.push(mergeTime(prevTimes.get(t.timeId), t, next.title));
    prevTimes.delete(t.timeId);
  }

  // Anything left over vanished upstream. Keep it, mark it cancelled.
  for (const stale of prevTimes.values()) {
    if (stale.status === 'cancelled') {
      times.push(stale);
    } else {
      summary.cancelledTimes.push(`${prev.title} @ ${stale.start}`);
      times.push({ ...stale, status: 'cancelled', cancelledAt: now });
    }
  }

  const merged = {
    ...prev,
    ...next,
    status: 'active',
    firstSeen: prev.firstSeen ?? now,
    times: times.sort(byStart),
  };
  delete merged.cancelledAt;

  // These are only ever *written* when they're true, so spreading prev
  // would keep them forever: a show whose ticket sales reopen, or whose
  // showtimes come back complete, would stay flagged for the rest of the
  // festival and keep printing the incomplete-showtimes warning. Merging is
  // about not losing history; a flag describing the show's current upstream
  // state isn't history.
  for (const flag of ['salesEnded', 'timesIncomplete']) {
    if (!next[flag]) delete merged[flag];
  }

  return merged;
}

// --- main ------------------------------------------------------------------

const cards = await scrapeCards();
console.log(`Found ${cards.length} show cards on the tickets page.`);
if (cards.length < MIN_EXPECTED_SHOWS) {
  fail(`only ${cards.length} shows parsed (expected >= ${MIN_EXPECTED_SHOWS}) -- the page markup probably changed`);
}

const scraped = [];
const partialShows = [];
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

  await sleep(200);
}
process.stdout.write('\n');

const isFirstRun = !existsSync(OUT);
const previous = isFirstRun ? { shows: [] } : JSON.parse(readFileSync(OUT, 'utf8'));
const prevShows = new Map((previous.shows ?? []).map((s) => [s.showId, s]));

const shows = [];
for (const s of scraped) {
  shows.push(mergeShow(prevShows.get(s.showId), s));
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

const tmp = `${OUT}.tmp`;
writeFileSync(tmp, `${JSON.stringify(out, null, 2)}\n`);
renameSync(tmp, OUT);

// --- report ----------------------------------------------------------------

const timeCount = shows.reduce((n, s) => n + s.times.length, 0);
const activeTimes = shows.reduce((n, s) => n + s.times.filter((t) => t.status === 'active').length, 0);
console.log(`\nWrote show_times.json: ${shows.length} shows, ${timeCount} showtimes (${activeTimes} active).`);

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

if (partialShows.length) {
  console.log(`\nWARNING -- ticket sales ended, showtimes may be incomplete (flagged "timesIncomplete"):`);
  for (const s of partialShows) console.log(`  - ${s}`);
  console.log('  Check the SimpleTix page for these; the API no longer lists every performance.');
}
