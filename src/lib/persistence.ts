import { useEffect, useRef } from 'react';
import { notCancelled } from './derived';
import type { Show, TimeId } from './types';

const STORAGE_KEY = 'fringe-picked';
const DEBOUNCE_MS = 250;

// A pick is encoded as the performance's own `timeId` - the upstream key the
// scraper treats as stable and never renumbers (see CLAUDE.md). Encoding the
// performance's *position* instead, as this used to, meant any change to the
// list shifted every pick after it: the scraper deliberately marks vanished
// showtimes `cancelled` rather than deleting them, but a cancellation still
// drops the performance out of the active list, so a saved or shared link
// silently resolved to a different showtime than the one that was picked.
//
// timeIds are unique across the whole festival, so a token needs no show
// prefix; they're `.`-separated, which no timeId contains, and every
// character used is legal in a URL fragment.
function keepablePerfs(show: Show) {
  return show.perfs.filter(notCancelled);
}

// The timeIds the rest of the app will actually render, so restoring one can
// never put an invisible entry in the schedule. That means dropping a
// *cancelled* performance, which has nowhere to show up - but keeping a
// played one, which still has its own hatched block on the board. Filtering
// to `status === 'active'` here, as this used to, stripped the pick on the
// first reload after the show finished its run and made the loss permanent.
function keepableTimeIds(shows: Show[]): Set<TimeId> {
  const ids = new Set<TimeId>();
  for (const show of shows) {
    for (const perf of keepablePerfs(show)) ids.add(perf.timeId);
  }
  return ids;
}

export function encodePicked(picked: Set<TimeId>, shows: Show[]): string {
  const valid = keepableTimeIds(shows);
  return [...picked].filter((id) => valid.has(id)).sort().join('.');
}

// Malformed or stale tokens are skipped individually rather than wiping the
// whole schedule - a single bad token shouldn't cost the user everything else.
export function decodePicked(encoded: string, shows: Show[]): Set<TimeId> {
  const valid = keepableTimeIds(shows);
  const result = new Set<TimeId>();
  if (!encoded) return result;

  for (const token of encoded.split('.')) {
    const t = token.trim();
    if (valid.has(t)) result.add(t);
  }

  return result;
}

// What the Sync sheet's restore box is handed: a whole schedule link, a bare
// token string, or the contents of the .json backup the sheet itself writes.
// Only the middle one is the on-the-wire encoding, so the other two have to
// be recognised here rather than passed straight to decodePicked - which is
// what made both of the sheet's advertised inputs fail.
export function parseRestoreInput(text: string, shows: Show[]): Set<TimeId> {
  const trimmed = text.trim();
  if (!trimmed) return new Set();
  if (trimmed.startsWith('[')) return decodeJsonBackup(trimmed, shows);

  // "https://host/path/#p=101.102" -> "101.102"; a bare token string has no
  // p= at all and is used as-is. The hash is where the app itself writes
  // picks, so it wins over a query string that happens to carry a stale p=.
  const param = /#p=([^&\s]*)/.exec(trimmed) ?? /[?&]p=([^&\s#]*)/.exec(trimmed);
  if (!param) return decodePicked(trimmed, shows);

  let value = param[1];
  try {
    value = decodeURIComponent(value); // a shared link may arrive percent-encoded
  } catch {
    // malformed escape - fall back to the raw value
  }
  return decodePicked(value, shows);
}

type BackupEntry = { timeId?: number | string; title?: string; day?: string; start?: number };

// The .json backup is written for humans to read (title, venue, address,
// times), so it carries a timeId for exact restores and is matched on
// title + day + start when reading a file written before that field existed.
function decodeJsonBackup(text: string, shows: Show[]): Set<TimeId> {
  const result = new Set<TimeId>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return result;
  }
  if (!Array.isArray(parsed)) return result;

  const valid = keepableTimeIds(shows);

  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as BackupEntry;

    if (entry.timeId !== undefined) {
      const id = String(entry.timeId);
      if (valid.has(id)) result.add(id);
      continue;
    }
    const hit = findByTitle(shows, entry.title, entry.day, entry.start);
    if (hit) result.add(hit.perf.timeId);
  }

  return result;
}

function findByTitle(shows: Show[], title?: string, day?: string, start?: number) {
  if (!title || !day || typeof start !== 'number') return undefined;
  const show = shows.find((s) => s.title === title);
  const perf = show && keepablePerfs(show).find((p) => p.day === day && p.start === start);
  return show && perf ? { show, perf } : undefined;
}

function readHashParam(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  return params.get('p') ?? '';
}

export function loadInitialPicked(shows: Show[]): Set<TimeId> {
  const fromUrl = readHashParam();
  if (fromUrl) return decodePicked(fromUrl, shows);

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return decodePicked(stored, shows);
  } catch {
    // localStorage unavailable (private browsing, etc.) - fall through to empty
  }

  return new Set();
}

// Keeps the URL hash and localStorage in sync with `picked`, debounced, using
// history.replaceState so picking doesn't spam browser history - which also
// means picks are not undoable with Back. Any popstate that does arrive is a
// real history traversal (or a hand-edited hash), so the URL is read back and
// applied.
export function usePersistence(picked: Set<TimeId>, shows: Show[], onExternalChange: (picked: Set<TimeId>) => void) {
  const timer = useRef<number | undefined>(undefined);

  // Read inside the popstate handler without making the listener re-subscribe
  // on every pick.
  const latestPicked = useRef(picked);
  useEffect(() => {
    latestPicked.current = picked;
  }, [picked]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      const encoded = encodePicked(picked, shows);
      const url = new URL(window.location.href);
      url.hash = encoded ? `p=${encoded}` : '';
      window.history.replaceState(null, '', url);

      try {
        window.localStorage.setItem(STORAGE_KEY, encoded);
      } catch {
        // ignore storage failures
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
  }, [picked, shows]);

  useEffect(() => {
    function onPopState() {
      // The old guard here tried to ignore this hook's own writes by setting
      // a flag before each replaceState - but replaceState doesn't fire
      // popstate, so the flag was only ever cleared by the first *genuine*
      // Back, which was then swallowed. Comparing against what's on screen
      // does the same job without eating a navigation.
      const fromUrl = readHashParam();
      if (fromUrl === encodePicked(latestPicked.current, shows)) return;
      onExternalChange(decodePicked(fromUrl, shows));
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [shows, onExternalChange]);
}
