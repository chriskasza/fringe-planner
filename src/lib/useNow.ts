import { useEffect, useState } from 'react';
import { nowInHalifax } from './dates';

// A minute is the finest granularity anything here renders (showtimes are on
// the minute, the grid axis on the half-hour), so polling more often would
// only cost renders.
const TICK_MS = 60_000;

// Halifax wall-clock "now" as React state. Reading nowInHalifax() directly
// during render leaves whatever it returned at mount frozen on screen - the
// "ON NOW" pill and the current day's grid axis both silently went stale
// while the page sat open, and neither could list it as a dependency because
// it isn't one.
export function useNow(): { date: string; minutes: number } {
  const [now, setNow] = useState(nowInHalifax);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow((prev) => {
        const next = nowInHalifax();
        // Same minute, same object: keeps the value referentially stable so
        // it can sit in a useMemo dependency list without thrashing.
        return next.date === prev.date && next.minutes === prev.minutes ? prev : next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return now;
}
