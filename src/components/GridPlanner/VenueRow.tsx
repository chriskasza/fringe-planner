import type { Show } from '../../lib/types';
import { GridBlock } from './GridBlock';
import { trackWidth } from './gridLayout';

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
      className="venue-row"
      style={{ width: labelWidth + trackWidth(slots.length), gridTemplateColumns: `${labelWidth}px 1fr` }}
    >
      <div className={`venue-row__label ${compact ? 'venue-row__label--compact' : ''}`}>
        <span className={`venue-row__name ${compact ? 'venue-row__name--compact' : ''}`}>{venue}</span>
        {!compact && venueAddress && <span className="venue-row__address">{venueAddress}</span>}
      </div>
      <div className="venue-row__track" style={{ width: trackWidth(slots.length) }}>
        {entries.map(({ show, perf }) => (
          <GridBlock key={`${show.id}-${perf.timeId}`} show={show} perf={perf} gridStartMin={gridStartMin} />
        ))}
      </div>
    </div>
  );
}
