// Merges freshly-scraped shows/showtimes into the previous show_times.json.
// Nothing is ever deleted -- see CLAUDE.md. Pure functions over their
// arguments: `now` and `summary` are passed in rather than read from module
// state, so a merge always reflects the run that called it.

import { byStart } from './util.mjs';

export function createSummary() {
  return { newShows: [], cancelledShows: [], newTimes: [], cancelledTimes: [], revived: [], changed: [] };
}

function mergeTime(prev, next, showTitle, now, summary) {
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

export function mergeShow(prev, next, now, summary) {
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
  // would keep them forever: a show that drops the "CANCELLED:" prefix off
  // its title, whose ticket sales reopen, or whose showtimes come back
  // complete, would stay flagged for the rest of the
  // festival and keep printing the incomplete-showtimes warning. Merging is
  // about not losing history; a flag describing the show's current upstream
  // state isn't history.
  for (const flag of ['cancelled', 'salesEnded', 'timesIncomplete']) {
    if (!next[flag]) delete merged[flag];
  }

  return merged;
}
