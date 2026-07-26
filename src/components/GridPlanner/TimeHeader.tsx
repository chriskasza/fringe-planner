import { formatTime } from '../../lib/dates';
import { LABEL_WIDTH, SLOT_WIDTH, trackWidth } from './gridLayout';

export function TimeHeader({ slots }: { slots: number[] }) {
  return (
    <div className="time-header" style={{ width: LABEL_WIDTH + trackWidth(slots.length) }}>
      <div className="time-header__spacer" />
      <div className="time-header__track" style={{ gridTemplateColumns: `repeat(${slots.length}, ${SLOT_WIDTH}px)` }}>
        {slots.map((s) => (
          <div key={s} className="time-header__label">
            {formatTime(s)}
          </div>
        ))}
      </div>
    </div>
  );
}
