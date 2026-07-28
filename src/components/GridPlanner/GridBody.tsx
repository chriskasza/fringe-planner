import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { visible } from '../../lib/derived';
import { useNow } from '../../lib/useNow';
import { gridTimeBounds, isPastPerf } from './gridLayout';
import { TimeHeader } from './TimeHeader';
import { VenueRow } from './VenueRow';
import type { Show } from '../../lib/types';
import styles from './GridPlanner.module.css';

export function GridBody() {
  const { state, shows, days } = useApp();
  const now = useNow();
  const { startMin, slots } = useMemo(
    () => gridTimeBounds(shows, state.gridDay, now),
    [shows, state.gridDay, now],
  );

  const day = days.find((d) => d.key === state.gridDay);
  const dayLabel = day ? day.label.toUpperCase() : state.gridDay;

  const byVenue = useMemo(() => {
    const map = new Map<string, { show: Show; perf: Show['perfs'][number] }[]>();
    for (const show of shows) {
      if (!visible(show, state, shows)) continue;
      for (const perf of show.perfs) {
        if (perf.status !== 'active' || perf.day !== state.gridDay) continue;
        // Same rule the axis uses, so a block can never sit off the left edge
        // of its own track.
        if (isPastPerf(perf, now)) continue;
        const list = map.get(show.venue) ?? [];
        list.push({ show, perf });
        map.set(show.venue, list);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shows, state, now]);

  // "Nothing matched" and "today is over" are different situations and the
  // filter advice is wrong for the second one.
  const dayIsSpent =
    state.gridDay === now.date &&
    shows.some((s) => s.perfs.some((p) => p.status === 'active' && p.day === state.gridDay));

  const venueAddress = (venue: string) => shows.find((s) => s.venue === venue)?.venueAddress ?? null;

  return (
    <div className={styles['grid-body']}>
      <div className={styles['grid-body__heading']}>
        <span className={styles['grid-body__day-title']}>{dayLabel}</span>
        <div className={styles['grid-body__legend']}>
          <span className={styles['grid-body__legend-item']}>
            <span className={`${styles['grid-body__swatch']} ${styles['grid-body__swatch--picked']}`} /> IN MY FRINGE
          </span>
          <span className={styles['grid-body__legend-item']}>
            <span className={`${styles['grid-body__swatch']} ${styles['grid-body__swatch--overlap']}`} /> OVERLAP
          </span>
          <span className={`${styles['grid-body__legend-item']} ${styles['grid-body__legend-item--faint']}`}>
            CLICK = PICK · ⓘ = DETAILS
          </span>
        </div>
      </div>

      {byVenue.length === 0 ? (
        <div className={styles['grid-body__empty']}>
          {dayIsSpent
            ? "Every performance today has finished. Pick another day to keep browsing."
            : 'No shows on this day match the current filters.'}
        </div>
      ) : (
        <div className={styles['grid-body__scroll']}>
          <TimeHeader slots={slots} />
          {byVenue.map(([venue, entries]) => (
            <VenueRow
              key={venue}
              venue={venue}
              venueAddress={venueAddress(venue)}
              entries={entries}
              slots={slots}
              gridStartMin={startMin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
