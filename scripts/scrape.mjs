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
//   node scripts/scrape.mjs

import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';

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
const OUT = fileURLToPath(new URL('../src/data/show_times.json', import.meta.url));
const META_OUT = fileURLToPath(new URL('../src/data/shows_meta.json', import.meta.url));
const VENUES_OUT = fileURLToPath(new URL('../src/data/venues.json', import.meta.url));

// "Show Passes" is a bundle product, not a show.
const SKIP_SHOW_IDS = new Set([284273]);

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

// Collapses everything to one line -- used for card titles/blurbs, where
// internal line breaks would just be noise.
function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Preserves <br>-derived newlines -- used for the multi-paragraph credits and
// content-warnings text on a show's ticket page, where lines are meaningful.
function stripTagsKeepingLines(s) {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
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

// --- meta (credits / rating / warnings / venue address) ---------------------

// Split the description block into <p>...</p> paragraphs, stripped to plain
// text. Labels ("Credits:", "Rating:", ...) sometimes wrap their own <strong>
// or <span> tags inconsistently, so match on the plain text, not the markup.
function paragraphs(html) {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTagsKeepingLines(m[1]));
}

// The value is either inline after the label in the same paragraph (Rating is
// usually this way) or the entirety of the next paragraph (Credits, Content
// Warnings are usually this way). Handle both.
function extractLabelled(html, label) {
  const paras = paragraphs(html);
  const re = new RegExp(`^${label}\\s*:\\s*(.*)$`, 'i');

  for (const [i, para] of paras.entries()) {
    const m = re.exec(para);
    if (!m) continue;
    if (m[1].trim()) return m[1].trim();
    return paras[i + 1]?.trim() || null;
  }
  return null;
}

function parseCredits(html) {
  const raw = extractLabelled(html, 'Credits');
  if (!raw) return [];
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

// Upstream capitalisation is inconsistent - the same warning arrives as
// "Flashing Lights", "Flashing lights" or "flashing lights" depending on who
// filled in the listing. Lower-case it so the warning chips read uniformly.
function parseWarnings(html) {
  const raw = extractLabelled(html, 'Content Warnings');
  if (!raw) return [];
  if (/^n\/a$/i.test(raw.trim())) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && !/^n\/a$/i.test(s));
}

function parseRating(html) {
  const raw = extractLabelled(html, 'Rating');
  return raw ? raw.trim() : 'NOT RATED';
}

function extractDescriptionBlock(html) {
  const m =
    /<div class="left_display" id="description">([\s\S]*?)<\/div>\s*<div class="left_display">/.exec(
      html,
    );
  return m ? m[1] : '';
}

function extractAddress(html) {
  const m =
    /"location":\{"@type":"Place","name":"((?:[^"\\]|\\.)*)","address":\{"@type":"PostalAddress"((?:[^{}]|\{[^{}]*\})*)\}/.exec(
      html,
    );
  if (!m) return null;

  const name = decodeEntities(JSON.parse(`"${m[1]}"`));
  const fields = {};
  for (const fm of m[2].matchAll(/"(\w+)":"((?:[^"\\]|\\.)*)"/g)) {
    fields[fm[1]] = JSON.parse(`"${fm[2]}"`);
  }

  const shortParts = [fields.streetAddress, fields.addressLocality].filter(Boolean);
  const fullParts = [
    fields.streetAddress,
    fields.addressLocality,
    fields.addressRegion,
    fields.postalCode,
  ].filter(Boolean);

  if (!shortParts.length) return { name, shortAddress: null, fullAddress: null };

  return {
    name,
    shortAddress: shortParts.join(', '),
    fullAddress: fullParts.length >= 3
      ? `${fullParts.slice(0, -1).join(', ')} ${fullParts.at(-1)}`
      : fullParts.join(', '),
  };
}

async function fetchMeta(showId, ticketUrl, title) {
  const res = await fetch(ticketUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fringe-calendar-scraper/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${ticketUrl}`);
  const html = await res.text();

  const block = extractDescriptionBlock(html);
  if (!block) console.warn(`  WARNING: no description block found for "${title}" (${showId})`);

  return {
    meta: {
      credits: parseCredits(block),
      rating: parseRating(block),
      warnings: parseWarnings(block),
    },
    address: extractAddress(html),
  };
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

const isFirstRun = !existsSync(OUT);
const previous = isFirstRun ? { shows: [] } : JSON.parse(readFileSync(OUT, 'utf8'));
const prevShows = new Map((previous.shows ?? []).map((s) => [s.showId, s]));

const previousMeta = existsSync(META_OUT) ? JSON.parse(readFileSync(META_OUT, 'utf8')) : {};
const previousVenues = existsSync(VENUES_OUT) ? JSON.parse(readFileSync(VENUES_OUT, 'utf8')) : {};

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

// --- report ----------------------------------------------------------------

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
