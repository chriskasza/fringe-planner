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
};

export function VenueRow({ venue, venueAddress, entries, slots, gridStartMin }: VenueRowProps) {
  return (
    <div
      data-testid="venue-row"
      className={styles['venue-row']}
      style={{
        width: `calc(var(--grid-label-width) + ${trackWidth(slots.length)}px)`,
        gridTemplateColumns: 'var(--grid-label-width) 1fr',
      }}
    >
      <div data-testid="venue-row-label" className={styles['venue-row__label']}>
        <span className={styles['venue-row__name']}>{venue}</span>
        {venueAddress && (
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
