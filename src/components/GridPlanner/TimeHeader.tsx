import { formatTime } from '../../lib/dates';
import { SLOT_WIDTH, trackWidth } from './gridLayout';
import styles from './GridPlanner.module.css';

export function TimeHeader({ slots, slotWidthPx = SLOT_WIDTH }: { slots: number[]; slotWidthPx?: number }) {
  return (
    <div
      data-testid="time-header"
      className={styles['time-header']}
      style={{
        width: `calc(var(--grid-label-width) + ${trackWidth(slots.length, slotWidthPx)}px)`,
        gridTemplateColumns: 'var(--grid-label-width) 1fr',
      }}
    >
      <div className={styles['time-header__spacer']} />
      <div
        className={styles['time-header__track']}
        style={{ gridTemplateColumns: `repeat(${slots.length}, ${slotWidthPx}px)` }}
      >
        {slots.map((s) => (
          <div key={s} data-testid="time-header-label" className={styles['time-header__label']}>
            {formatTime(s)}
          </div>
        ))}
      </div>
    </div>
  );
}
