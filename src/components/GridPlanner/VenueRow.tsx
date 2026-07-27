import type { Show } from '../../lib/types';
import { GridBlock } from './GridBlock';
import { trackWidth } from './gridLayout';
import styles from './GridPlanner.module.css';

type VenueRowProps = {
  venue: string;
  venueAddress: string | null;
  entries: { show: Show; perf: Show['perfs'][number] }[];
  slots: number[];
  gridStartMin: number;
  labelWidth: number;
  compact?: boolean;
};

export function VenueRow({
  venue,
  venueAddress,
  entries,
  slots,
  gridStartMin,
  labelWidth,
  compact = false,
}: VenueRowProps) {
  return (
    <div
      data-testid="venue-row"
      className={styles['venue-row']}
      style={{ width: labelWidth + trackWidth(slots.length), gridTemplateColumns: `${labelWidth}px 1fr` }}
    >
      <div
        data-testid="venue-row-label"
        data-compact={compact}
        className={`${styles['venue-row__label']} ${compact ? styles['venue-row__label--compact'] : ''}`}
      >
        <span className={`${styles['venue-row__name']} ${compact ? styles['venue-row__name--compact'] : ''}`}>
          {venue}
        </span>
        {!compact && venueAddress && (
          <span data-testid="venue-row-address" className={styles['venue-row__address']}>
            {venueAddress}
          </span>
        )}
      </div>
      <div className={styles['venue-row__track']} style={{ width: trackWidth(slots.length) }}>
        {entries.map(({ show, perf }) => (
          <GridBlock key={`${show.id}-${perf.timeId}`} show={show} perf={perf} gridStartMin={gridStartMin} />
        ))}
      </div>
    </div>
  );
}
