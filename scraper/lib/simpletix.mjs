// Everything that talks to the SimpleTix pin board + embed API: the show
// list (cards) and each show's times/venue data. The show's own ticket page
// (credits/rating/warnings/address) is scraped separately -- see meta.mjs.

import { fail, localStamp, stripLeadingThe, stripTags } from './util.mjs';

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

const API_BASE = 'https://api.prod.simpletix.com/embed/Event';

// "Show Passes" is a bundle product, not a show.
const SKIP_SHOW_IDS = new Set([284273]);

export async function scrapeCards() {
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

export async function fetchShowData(showId) {
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

export async function resolveTimes(showId, data, salesEnded) {
  const venue = stripLeadingThe(data.venueTitle);

  // Normal case: a real eventTimes array with real timeIds.
  if (data.eventTimes?.length) {
    return {
      times: data.eventTimes.map((t) => ({
        timeId: t.timeId,
        start: localStamp(t.dateStart),
        end: localStamp(t.dateEnd),
        venue: stripLeadingThe(t.venueTitle) || venue,
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
