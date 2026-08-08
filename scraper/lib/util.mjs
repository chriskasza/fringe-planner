// Generic string/HTML helpers and small utilities shared across the scraper
// modules. Nothing here talks to the network or knows about SimpleTix.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', eacute: 'é',
};

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? m);
}

// Collapses everything to one line -- used for card titles/blurbs, where
// internal line breaks would just be noise.
export function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Preserves <br>-derived newlines -- used for the multi-paragraph credits and
// content-warnings text on a show's ticket page, where lines are meaningful.
export function stripTagsKeepingLines(s) {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

// Venue names come back from upstream as e.g. "The Art Gallery of Nova
// Scotia" -- drop the leading article so it matches the SHORT_NAMES lookup
// in scrape.mjs and reads consistently everywhere the venue name is shown.
export function stripLeadingThe(s) {
  return (s ?? '').replace(/^the\s+/i, '');
}

export function slugify(title) {
  return decodeEntities(title)
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// The API returns local Halifax wall time with a bogus trailing Z.
// "2026-09-03T14:00:00Z" is the 2:00 PM show, not 11:00 AM. Keep it naive.
export function localStamp(s) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(s ?? '');
  if (!m) throw new Error(`unparseable timestamp: ${s}`);
  return `${m[1]}T${m[2]}`;
}

// Upstream marks a cancelled show by prefixing its pin board title ("CANCELLED:
// All Below"). That prefix is the only explicit signal it gives: the embed API
// keeps answering, and the show's own ticket page still lists its now-defunct
// showtimes. See scrape.mjs for why a match means we emit no times at all.
export const isCancelledTitle = (title) => /^\s*CANCELLED\s*[:–—-]/i.test(title ?? '');

// The show page's JSON-LD is the ONE upstream timestamp that means what it
// says: "2026-09-04T20:45:00+00:00" really is 20:45 UTC, i.e. 17:45 in Halifax.
// That is the exact opposite of the embed API's `dateStart` above, and the
// reason localStamp must never be pointed at this field (nor this function at
// that one) -- each would shift the other's times by three hours. Verified on
// all three of "Game of drones"' slots against the times its own description
// lists in prose, and the caller re-checks the conversion against the API's own
// times before trusting it (see mergePageTimes in scrape.mjs).
const HALIFAX_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Halifax',
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function halifaxStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`unparseable JSON-LD timestamp: ${iso}`);
  const p = {};
  for (const part of HALIFAX_PARTS.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// timeId is numeric for normal showtimes and a synthetic string for the handful the
// API reports without one, so compare as strings.
export const byStart = (a, b) =>
  a.start.localeCompare(b.start) || String(a.timeId).localeCompare(String(b.timeId));

export function fail(msg) {
  console.error(`\n  FAILED: ${msg}`);
  console.error('  show_times.json was left untouched.\n');
  process.exit(1);
}
