import { useEffect, useRef } from 'react';
import { perfKey } from './derived';
import type { PerfKey, Show } from './types';

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
function activePerfs(show: Show) {
  return show.perfs.filter((p) => p.status === 'active');
}

// timeId -> the performance it names. Active only, matching what the rest of
// the app will actually render: a pick whose performance has since been
// cancelled has nowhere to show up, so restoring it would put an invisible
// entry in the schedule.
function perfsByTimeId(shows: Show[]): Map<string, { show: Show; perf: Show['perfs'][number] }> {
  const map = new Map<string, { show: Show; perf: Show['perfs'][number] }>();
  for (const show of shows) {
    for (const perf of activePerfs(show)) map.set(String(perf.timeId), { show, perf });
  }
  return map;
}

export function encodePicked(picked: Set<PerfKey>, shows: Show[]): string {
  const byId = new Map(shows.map((s) => [s.id, s]));
  const tokens: string[] = [];

  for (const key of picked) {
    const [showId, day, startStr] = key.split('|');
    const show = byId.get(showId);
    if (!show) continue;

    const perf = activePerfs(show).find((p) => p.day === day && p.start === Number(startStr));
    if (!perf) continue;

    tokens.push(String(perf.timeId));
  }

  return tokens.sort().join('.');
}

// Malformed or stale tokens are skipped individually rather than wiping the
// whole schedule - a single bad token shouldn't cost the user everything else.
export function decodePicked(encoded: string, shows: Show[]): Set<PerfKey> {
  const byTimeId = perfsByTimeId(shows);
  const result = new Set<PerfKey>();
  if (!encoded) return result;

  for (const token of encoded.split('.')) {
    const hit = byTimeId.get(token.trim());
    if (!hit) continue;
    result.add(perfKey(hit.show.id, hit.perf.day, hit.perf.start));
  }

  return result;
}

function readHashParam(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  return params.get('p') ?? '';
}

export function loadInitialPicked(shows: Show[]): Set<PerfKey> {
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
// history.replaceState so picking doesn't spam browser history. Parses the URL
// back on `popstate` (Back/Forward), guarded so our own writes don't re-trigger
// a parse.
export function usePersistence(picked: Set<PerfKey>, shows: Show[], onExternalChange: (picked: Set<PerfKey>) => void) {
  const selfWrite = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      const encoded = encodePicked(picked, shows);
      selfWrite.current = true;
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
      if (selfWrite.current) {
        selfWrite.current = false;
        return;
      }
      onExternalChange(decodePicked(readHashParam(), shows));
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [shows, onExternalChange]);
}
