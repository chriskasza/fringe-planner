// Scrapes each show's own SimpleTix ticket page for credits, rating, content
// warnings, and (via its JSON-LD) the venue's address -- none of which the
// pin board or embed API expose. See simpletix.mjs for those.

import { decodeEntities, stripTagsKeepingLines } from './util.mjs';

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

export async function fetchMeta(showId, ticketUrl, title) {
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
