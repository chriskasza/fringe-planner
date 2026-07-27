import { useApp } from '../../state/AppContext';
import { visible } from '../../lib/derived';
import { ShowCard } from './ShowCard';
import styles from './CardGrid.module.css';

export function CardGrid({ compact = false }: { compact?: boolean }) {
  const { state, shows } = useApp();
  const visibleShows = shows
    .filter((s) => visible(s, state, shows))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className={`${styles['card-grid']} ${compact ? styles['card-grid--compact'] : ''}`}>
      {visibleShows.length === 0 && (
        <div className={styles['card-grid__empty']}>No shows match the current filters.</div>
      )}
      {visibleShows.map((show) => (
        <ShowCard key={show.id} show={show} />
      ))}
    </div>
  );
}
