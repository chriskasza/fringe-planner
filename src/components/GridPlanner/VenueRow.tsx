import type { Show } from '../../lib/types';
import { GridBlock } from './GridBlock';
import { SLOT_WIDTH, trackWidth } from './gridLayout';
import styles from './GridPlanner.module.css';

type VenueRowProps = {
  venue: string;
  venueAddress: string | null;
  entries: { show: Show; perf: Show['perfs'][number] }[];
  slots: number[];
  gridStartMin: number;
  slotWidthPx?: number;
};

export function VenueRow({
  venue,
  venueAddress,
  entries,
  slots,
  gridStartMin,
  slotWidthPx = SLOT_WIDTH,
}: VenueRowProps) {
  // Full name and the mobile-safe short form both stay in the DOM at every
  // width - CSS alone (the @media block in GridPlanner.module.css) decides
  // which one is visible, same pattern as the wordmark in TopBar.tsx.
  const venueShortMobile = entries[0]?.show.venueShortMobile ?? venue;

  return (
    <div
      data-testid="venue-row"
      className={styles['venue-row']}
      style={{
        width: `calc(var(--grid-label-width) + ${trackWidth(slots.length, slotWidthPx)}px)`,
        gridTemplateColumns: 'var(--grid-label-width) 1fr',
      }}
    >
      <div data-testid="venue-row-label" className={styles['venue-row__label']}>
        <span className={styles['venue-row__name']}>{venue}</span>
        <span className={styles['venue-row__name-mobile']}>{venueShortMobile}</span>
        {venueAddress && (
          <span data-testid="venue-row-address" className={styles['venue-row__address']}>
            {venueAddress}
          </span>
        )}
      </div>
      <div className={styles['venue-row__track']} style={{ width: trackWidth(slots.length, slotWidthPx) }}>
        {entries.map(({ show, perf }) => (
          <GridBlock
            key={`${show.id}-${perf.timeId}`}
            show={show}
            perf={perf}
            gridStartMin={gridStartMin}
            slotWidthPx={slotWidthPx}
          />
        ))}
      </div>
    </div>
  );
}
