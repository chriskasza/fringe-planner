import { useApp } from '../../state/AppContext';
import { compareShowsBySoonest, nextActivePerf, visible } from '../../lib/derived';
import { useNow } from '../../lib/useNow';
import { shows as allShows } from '../../lib/loadData';
import { ShowCard } from './ShowCard';
import type { Show } from '../../lib/types';
import styles from './CardGrid.module.css';

// One shuffle per page load, not per render: Math.random() can't run inside a
// component body (React's purity rule), and this needs to run exactly once
// anyway so Random doesn't reshuffle every time an unrelated filter changes.
const randomWeight = new Map(allShows.map((s) => [s.id, Math.random()]));

export function CardGrid() {
  const { state, shows } = useApp();
  const now = useNow();

  const visibleShows = shows.filter((s) => visible(s, state, shows));
  switch (state.sort) {
    case 'title':
      visibleShows.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'soonest':
      visibleShows.sort((a, b) => compareShowsBySoonest(a, b, now));
      break;
    case 'random':
    default:
      visibleShows.sort((a, b) => randomWeight.get(a.id)! - randomWeight.get(b.id)!);
  }

  // Shows with nothing left to plan around sink to the bottom under every
  // sort - cancelled ones, and now shows whose whole run has been played.
  // Both are kept listed (a played show is the user's own history), but a
  // browser that leads with them is showing you what you can no longer do:
  // the default sort is Random, so without this a finished show sits
  // interleaved with bookable ones. Only the Soonest sort handled it before,
  // via nextActivePerf. Array#sort is stable, so this partitions without
  // disturbing the order the switch above chose within each group.
  const spent = (s: Show) => s.cancelled || !nextActivePerf(s, now);
  visibleShows.sort((a, b) => Number(spent(a)) - Number(spent(b)));

  return (
    <div className={styles['card-grid']}>
      {visibleShows.length === 0 && (
        <div className={styles['card-grid__empty']}>No shows match the current filters.</div>
      )}
      {visibleShows.map((show) => (
        <ShowCard key={show.id} show={show} />
      ))}
    </div>
  );
}
