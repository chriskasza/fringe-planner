import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../state/AppContext';
import { notCancelled, visible } from '../../lib/derived';
import { useNow } from '../../lib/useNow';
import { useIsNarrow } from '../../lib/useIsNarrow';
import { gridTimeBounds, scrollAnchorLeft, slotWidth } from './gridLayout';
import { TimeHeader } from './TimeHeader';
import { VenueRow } from './VenueRow';
import type { Show } from '../../lib/types';
import styles from './GridPlanner.module.css';

export function GridBody() {
  const { state, shows } = useApp();
  const now = useNow();
  const isNarrow = useIsNarrow();
  const slotWidthPx = slotWidth(isNarrow);
  const { startMin, slots } = useMemo(
    () => gridTimeBounds(shows, state.gridDay),
    [shows, state.gridDay],
  );

  const byVenue = useMemo(() => {
    const map = new Map<string, { show: Show; perf: Show['perfs'][number] }[]>();
    for (const show of shows) {
      if (!visible(show, state, shows)) continue;
      for (const perf of show.perfs) {
        // Played performances keep their block - GridBlock hatches them. Only
        // a cancelled slot, which never happened, has nothing to render.
        if (!notCancelled(perf) || perf.day !== state.gridDay) continue;
        const list = map.get(show.venue) ?? [];
        list.push({ show, perf });
        map.set(show.venue, list);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shows, state]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Orient the day on what's still to come. Keyed on gridDay alone,
  // deliberately *not* on `now`: re-running each minute would yank the grid
  // sideways under a user who had scrolled somewhere else. The ref is null
  // while the empty state is rendered, so the guard is load-bearing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = scrollAnchorLeft(
      shows.flatMap((s) => s.perfs),
      state.gridDay,
      now,
      startMin,
      slotWidthPx,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` is read fresh each render but must not *retrigger* this; see the comment above
  }, [state.gridDay, startMin, slotWidthPx, shows]);

  const venueAddress = (venue: string) => shows.find((s) => s.venue === venue)?.venueAddress ?? null;

  return (
    <div className={styles['grid-body']}>
      {byVenue.length === 0 ? (
        <div className={styles['grid-body__empty']}>
          No shows on this day match the current filters.
        </div>
      ) : (
        <div className={styles['grid-body__scroll']} ref={scrollRef}>
          <TimeHeader slots={slots} slotWidthPx={slotWidthPx} />
          {byVenue.map(([venue, entries]) => (
            <VenueRow
              key={venue}
              venue={venue}
              venueAddress={venueAddress(venue)}
              entries={entries}
              slots={slots}
              gridStartMin={startMin}
              slotWidthPx={slotWidthPx}
            />
          ))}
        </div>
      )}
    </div>
  );
}
