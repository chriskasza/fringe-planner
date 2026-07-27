import { useApp } from '../../state/AppContext';
import { perfKey } from '../../lib/derived';
import { dayRailCellState } from './dayRailState';
import type { Show } from '../../lib/types';
import styles from './DayRail.module.css';

type DayRailProps = {
  show: Show;
  onExpand: () => void; // a day with more than one performance opens the time-pill list instead
};

export function DayRail({ show, onExpand }: DayRailProps) {
  const { state, dispatch, shows, days } = useApp();

  return (
    <div className={styles['day-rail']}>
      {days.map((d) => {
        const { cellState, count } = dayRailCellState(show, d.key, state, shows);

        function handleClick() {
          if (count === 0) return;
          if (count === 1) {
            const perf = show.perfs.find((p) => p.status === 'active' && p.day === d.key);
            if (perf) dispatch({ type: 'TOGGLE_PICK', key: perfKey(show.id, perf.day, perf.start) });
          } else {
            onExpand();
          }
        }

        return (
          <button
            key={d.key}
            type="button"
            className={`${styles['day-rail__cell']} ${styles[`day-rail__cell--${cellState}`]}`}
            onClick={handleClick}
            disabled={count === 0}
            aria-label={
              count === 0
                ? `${d.label}: no performance`
                : `${d.label}: ${count} performance${count > 1 ? 's' : ''}, ${cellState.replace('-', ' ')}`
            }
          >
            <span className={styles['day-rail__num']}>{d.dateNum}</span>
            {count > 1 && <span className={styles['day-rail__mult']}>×{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
