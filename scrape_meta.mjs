#!/usr/bin/env node
// Scrapes per-show metadata (credits, content warnings, rating) and venue
// addresses from each show's SimpleTix page, into src/data/shows_meta.json
// and src/data/venues.json.
//
// Separate from scrape.mjs because it changes on a different cadence: showtimes
// shift week to week, but credits/ratings/warnings are set once and rarely
// change after a show is listed. Re-run whenever show_times.json gains new
// shows, or to pick up a rating/warning correction upstream.
//
//   node scrape_meta.mjs

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';

const SHOW_TIMES = new URL('./show_times.json', import.meta.url).pathname;
const META_OUT = new URL('./src/data/shows_meta.json', import.meta.url).pathname;
const VENUES_OUT = new URL('./src/data/venues.json', import.meta.url).pathname;

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

function stripTags(s) {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Split the description block into <p>...</p> paragraphs, stripped to plain
// text. Labels ("Credits:", "Rating:", ...) sometimes wrap their own <strong>
// or <span> tags inconsistently, so match on the plain text, not the markup.
function paragraphs(html) {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
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

function parseWarnings(html) {
  const raw = extractLabelled(html, 'Content Warnings');
  if (!raw) return [];
  if (/^n\/a$/i.test(raw.trim())) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
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

// --- main --------------------------------------------------------------

const { shows } = JSON.parse(readFileSync(SHOW_TIMES, 'utf8'));

const previousMeta = existsSync(META_OUT) ? JSON.parse(readFileSync(META_OUT, 'utf8')) : {};
const previousVenues = existsSync(VENUES_OUT) ? JSON.parse(readFileSync(VENUES_OUT, 'utf8')) : {};

const meta = {};
const venues = { ...previousVenues };
const failed = [];

for (const [i, show] of shows.entries()) {
  process.stdout.write(`  [${i + 1}/${shows.length}] ${show.title.slice(0, 50)}\r`);

  try {
    const { meta: showMeta, address } = await fetchMeta(show.showId, show.ticketUrl, show.title);
    meta[String(show.showId)] = showMeta;

    if (address && show.venue) {
      const short = SHORT_NAMES[show.venue] ?? show.venue.toUpperCase();
      venues[show.venue] = {
        short,
        shortAddress: address.shortAddress,
        fullAddress: address.fullAddress,
      };
    }
  } catch (err) {
    failed.push(`${show.title} (${show.showId}): ${err.message}`);
    if (previousMeta[String(show.showId)]) meta[String(show.showId)] = previousMeta[String(show.showId)];
  }

  await sleep(200);
}
process.stdout.write('\n');

mkdirSync(new URL('./src/data', import.meta.url).pathname, { recursive: true });

for (const [out, data] of [[META_OUT, meta], [VENUES_OUT, venues]]) {
  const tmp = `${out}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, out);
}

console.log(`\nWrote shows_meta.json: ${Object.keys(meta).length} shows.`);
console.log(`Wrote venues.json: ${Object.keys(venues).length} venues.`);

if (failed.length) {
  console.log(`\n${failed.length} show(s) failed to fetch (kept previous data if available):`);
  for (const f of failed) console.log(`  - ${f}`);
}

const noRating = Object.entries(meta).filter(([, m]) => m.rating === 'NOT RATED');
if (noRating.length) {
  console.log(`\n${noRating.length} show(s) had no parsed rating (defaulted to NOT RATED):`);
  for (const [id] of noRating) {
    const s = shows.find((x) => String(x.showId) === id);
    console.log(`  - ${s?.title ?? id} (${id})`);
  }
}
