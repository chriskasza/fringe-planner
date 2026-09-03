import { useApp } from '../../state/AppContext';
import styles from './DayStrip.module.css';

export function DayStrip() {
  const { state, dispatch, days } = useApp();

  return (
    <div className={styles['day-strip']}>
      {days.map((d) => {
        const selected = state.gridDay === d.key;
        const dimmed = !state.daysOn[d.key];
        return (
          <button
            key={d.key}
            type="button"
            data-testid="day-strip-tab"
            className={[
              styles['day-strip__tab'],
              selected ? styles['day-strip__tab--selected'] : '',
              // Not `style={{ opacity: 0.5 }}`, which is what this used to
              // be: that blends the label *and* its background toward the ink
              // behind the strip, and axe reported it as a serious
              // color-contrast failure on every dimmed tab. The class changes
              // `color` instead - see .day-strip__tab--dimmed and CLAUDE.md.
              dimmed ? styles['day-strip__tab--dimmed'] : '',
            ].filter(Boolean).join(' ')}
            onClick={() => dispatch({ type: 'SET_GRID_DAY', day: d.key })}
          >
            <span className={`${styles['day-strip__dow']} ${selected ? styles['day-strip__dow--selected'] : ''}`}>
              {d.dow}
            </span>
            <span className={styles['day-strip__num']}>{d.dateNum}</span>
          </button>
        );
      })}
    </div>
  );
}
