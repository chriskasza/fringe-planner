// Merges freshly-scraped shows/showtimes into the previous show_times.json.
// Nothing is ever deleted -- see CLAUDE.md. Pure functions over their
// arguments: `now` and `summary` are passed in rather than read from module
// state, so a merge always reflects the run that called it.

import { byStart } from './util.mjs';

export function createSummary() {
  return {
    newShows: [], cancelledShows: [], endedShows: [],
    newTimes: [], cancelledTimes: [], endedTimes: [],
    revived: [], changed: [],
  };
}

// A performance that vanishes upstream is ambiguous: the festival delists a slot
// both when it is cancelled and when it has simply been played. Everything before
// `nowLocal` has already happened, so it ended; everything after it is a genuine
// cancellation. Compare `start`, never `end` -- upstream end times are sometimes
// plainly wrong and several are curated in scrape.mjs's DURATION_OVERRIDES, while
// `start` is the value the whole file is keyed on.
//
// Both stamps are naive Halifax wall time ("2026-09-03T14:00"), so a plain string
// comparison is the right one and no stored timestamp is ever handed to
// `new Date()` -- see CLAUDE.md. `nowLocal` comes from halifaxStamp(now).
//
// Already-retired slots are returned as-is, which is what keeps a same-day
// re-scrape byte-identical instead of restamping them with a fresh `now`.
export function retireTime(time, nowLocal, now) {
  if (time.status !== 'active') return time;
  return time.start <= nowLocal
    ? { ...time, status: 'ended', endedAt: now }
    : { ...time, status: 'cancelled', cancelledAt: now };
}

function mergeTime(prev, next, showTitle, now, summary) {
  if (!prev) {
    summary.newTimes.push(`${showTitle} @ ${next.start}`);
    return { ...next, status: 'active', firstSeen: now };
  }

  const merged = { ...prev, ...next, status: 'active', firstSeen: prev.firstSeen ?? now };

  // Line above forces status back to 'active', so a leftover retirement stamp
  // would contradict it -- clear whichever one is there.
  if (prev.status !== 'active') {
    delete merged.cancelledAt;
  delete merged.endedAt;
    delete merged.endedAt;
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

export function mergeShow(prev, next, now, nowLocal, summary) {
  if (!prev) {
    summary.newShows.push(next.title);
    return {
      ...next,
      status: 'active',
      firstSeen: now,
      times: next.times.map((t) => mergeTime(null, t, next.title, now, summary)),
    };
  }

  const prevTimes = new Map((prev.times ?? []).map((t) => [t.timeId, t]));
  const times = [];

  for (const t of next.times) {
    times.push(mergeTime(prevTimes.get(t.timeId), t, next.title, now, summary));
    prevTimes.delete(t.timeId);
  }

  // Anything left over vanished upstream. Keep it -- retireTime decides whether
  // that means it was cancelled or simply played.
  for (const stale of prevTimes.values()) {
    const retired = retireTime(stale, nowLocal, now);
    if (retired !== stale) {
      const bucket = retired.status === 'ended' ? summary.endedTimes : summary.cancelledTimes;
      bucket.push(`${prev.title} @ ${stale.start}`);
    }
    times.push(retired);
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
  // would keep them forever: a show that drops the "CANCELLED:" prefix off
  // its title, whose ticket sales reopen, or whose showtimes come back
  // complete, would stay flagged for the rest of the
  // festival and keep printing the incomplete-showtimes warning. Merging is
  // about not losing history; a flag describing the show's current upstream
  // state isn't history.
  for (const flag of ['cancelled', 'freeAdmission', 'salesEnded', 'timesIncomplete']) {
    if (!next[flag]) delete merged[flag];
  }

  return merged;
}
