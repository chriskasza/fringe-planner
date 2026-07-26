import type { Show } from '../../lib/types';
import { GridBlock } from './GridBlock';

type VenueRowProps = {
  venue: string;
  venueAddress: string | null;
  entries: { show: Show; perf: Show['perfs'][number] }[];
  slots: number[];
  gridStartMin: number;
};

export function VenueRow({ venue, venueAddress, entries, slots, gridStartMin }: VenueRowProps) {
  const sorted = [...entries].sort((a, b) => a.perf.start - b.perf.start);

  return (
    <div className="venue-row">
      <div className="venue-row__label">
        <span className="venue-row__name">{venue}</span>
        {venueAddress && <span className="venue-row__address">{venueAddress}</span>}
      </div>
      <div
        className="venue-row__track"
        style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0,1fr))` }}
      >
        {sorted.map(({ show, perf }) => (
          <GridBlock key={`${show.id}-${perf.timeId}`} show={show} perf={perf} gridStartMin={gridStartMin} />
        ))}
      </div>
    </div>
  );
}
