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

// Condensed categories for the front-end's Content Warning filter, so it
// offers a short fixed list instead of every distinct freeform phrase
// creators type into their SimpleTix listing. Keyed by the exact fragment
// parseWarnings produces (already lower-cased and comma-split) -- a fragment
// can belong to more than one category.
const WARNING_CATEGORIES = {
  swearing: ['Coarse Language'],
  'strong language': ['Coarse Language'],
  'swearing and depictions of cheating/adultery': ['Coarse Language'],
  'mild vulgarity': ['Coarse Language'],
  'adult language': ['Coarse Language'],
  'coarse language': ['Coarse Language'],
  'swearing and sexual language': ['Coarse Language', 'Sexual Content'],

  'sexual content': ['Sexual Content'],
  'sexual references': ['Sexual Content'],
  'sexually explicit content': ['Sexual Content'],
  sex: ['Sexual Content'],
  nudity: ['Sexual Content'],
  'partial nudity (minimal coverage)': ['Sexual Content'],
  pornography: ['Sexual Content'],
  'and general sexual content': ['Sexual Content'],
  'mentions of mental illness and sexual themes': ['Mental Health & Suicide', 'Sexual Content'],
  'discussion of sexual assault': ['Sexual Content', 'Abuse'],

  violence: ['Violence'],
  'implied violence': ['Violence'],
  'cartoon violence': ['Violence'],
  'depictions of violence': ['Violence'],
  'mention of violence': ['Violence'],
  weapons: ['Violence'],
  'weapon (fake/foam)': ['Violence'],
  injuries: ['Violence'],
  blood: ['Violence'],
  murder: ['Violence'],
  'gun and explosion sounds': ['Violence', 'Loud Sounds'],
  'brief sounds of gunfire (no visuals)': ['Violence', 'Loud Sounds'],
  'graphic depictions of death': ['Violence', 'Death & Grief'],

  death: ['Death & Grief'],
  'discussions of death': ['Death & Grief'],
  'mention of death': ['Death & Grief'],
  'brief mention of death': ['Death & Grief'],
  'talk of death': ['Death & Grief'],
  'discussion about death': ['Death & Grief'],
  'mortality is discussed.': ['Death & Grief'],
  'grief and loss': ['Death & Grief'],

  'discussions of mental health': ['Mental Health & Suicide'],
  suicide: ['Mental Health & Suicide'],
  'mention of suicide': ['Mental Health & Suicide'],
  'description of suicidal attempt': ['Mental Health & Suicide'],
  'discussion of mental illnesses (ocd': ['Mental Health & Suicide'],
  anxiety: ['Mental Health & Suicide'],
  'and depression)': ['Mental Health & Suicide'],
  'and war. depiction of mental health.': ['War & Atrocity', 'Mental Health & Suicide'],

  'substance abuse': ['Substance Use'],
  'drug use': ['Substance Use'],
  'references to drug use and smoking': ['Substance Use'],
  'cannabis is mentioned': ['Substance Use'],

  abuse: ['Abuse'],
  'self-punishment': ['Abuse'],

  'flashing lights': ['Flashing Lights'],

  'loud rumbling sounds (earthquake and frothing water)': ['Loud Sounds'],
  'loud sinister music near end': ['Loud Sounds'],
  'loud sounds': ['Loud Sounds'],

  'audience interaction': ['Audience Interaction'],

  'references to genocide': ['War & Atrocity'],
  war: ['War & Atrocity'],
  bombs: ['War & Atrocity'],
  'atomic bombs': ['War & Atrocity'],
  'and ww2': ['War & Atrocity'],
  colonialism: ['War & Atrocity'],

  'several scary (ghost) stories are told within the play': ['Paranormal / Horror Themes'],
  'paranormal theme': ['Paranormal / Horror Themes'],
};

// Raw fragments that describe something too vague, thematic, or show-specific
// to work as a content warning -- a filter chip for these would tell a
// browsing audience member nothing actionable. Listed explicitly (rather than
// just being absent from WARNING_CATEGORIES) so they're skipped quietly
// instead of tripping the "unrecognised warning" check below.
const IGNORED_WARNINGS = new Set([
  'apples',
  'existentialism',
  'historic bureaucracy',
  'mature themes',
  'sections of this show feature a white woman discussing decolonization',
]);

// Collapses this show's raw warnings down to the fixed category list the
// front-end filters on. Unlike `warnings` itself, this is derived data, so an
// unrecognised fragment is loud (console.warn) rather than silently dropped
// -- a new show introducing new warning wording should surface here for
// triage (add it to WARNING_CATEGORIES or IGNORED_WARNINGS above) instead of
// quietly vanishing from the filter.
function categorizeWarnings(rawWarnings, title) {
  const tags = new Set();
  for (const raw of rawWarnings) {
    if (IGNORED_WARNINGS.has(raw)) continue;
    const categories = WARNING_CATEGORIES[raw];
    if (!categories) {
      console.warn(
        `  WARNING: no content-warning category for "${raw}" (${title}) -- add it to WARNING_CATEGORIES or IGNORED_WARNINGS in meta.mjs`,
      );
      continue;
    }
    for (const category of categories) tags.add(category);
  }
  return [...tags].sort();
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

  const warnings = parseWarnings(block);

  return {
    meta: {
      credits: parseCredits(block),
      rating: parseRating(block),
      warnings,
      warningTags: categorizeWarnings(warnings, title),
    },
    address: extractAddress(html),
  };
}
