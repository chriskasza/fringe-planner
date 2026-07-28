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
