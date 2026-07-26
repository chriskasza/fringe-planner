import { useEffect, useRef } from 'react';
import { perfKey } from './derived';
import type { PerfKey, Show } from './types';

const STORAGE_KEY = 'fringe-picked';
const DEBOUNCE_MS = 250;

// Active perfs only, in the same sorted order transform.ts produces (day then
// start) - stable as long as the show's own data doesn't change, which is all
// the encoding needs.
function activePerfs(show: Show) {
  return show.perfs.filter((p) => p.status === 'active');
}

function letterFor(index: number): string | null {
  return index < 26 ? String.fromCharCode(65 + index) : null;
}

export function encodePicked(picked: Set<PerfKey>, shows: Show[]): string {
  const byId = new Map(shows.map((s) => [s.id, s]));
  const tokens: string[] = [];

  for (const key of picked) {
    const [showId, day, startStr] = key.split('|');
    const show = byId.get(showId);
    if (!show) continue;

    const index = activePerfs(show).findIndex((p) => p.day === day && p.start === Number(startStr));
    if (index < 0) continue;

    const letter = letterFor(index);
    if (!letter) continue; // show has more than 26 performances - shouldn't happen, skip rather than corrupt

    tokens.push(`${Number(showId).toString(36)}${letter}`);
  }

  return tokens.sort().join('.');
}

// Malformed or stale tokens are skipped individually rather than wiping the
// whole schedule - a single bad token shouldn't cost the user everything else.
export function decodePicked(encoded: string, shows: Show[]): Set<PerfKey> {
  const byId = new Map(shows.map((s) => [s.id, s]));
  const result = new Set<PerfKey>();
  if (!encoded) return result;

  for (const token of encoded.split('.')) {
    const m = /^([0-9a-z]+)([A-Z])$/.exec(token);
    if (!m) continue;

    const showId = String(parseInt(m[1], 36));
    const index = m[2].charCodeAt(0) - 65;
    const show = byId.get(showId);
    if (!show) continue;

    const perf = activePerfs(show)[index];
    if (!perf) continue;

    result.add(perfKey(show.id, perf.day, perf.start));
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
