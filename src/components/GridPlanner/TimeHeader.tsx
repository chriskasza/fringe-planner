import { formatTime } from '../../lib/dates';
import { SLOT_WIDTH, trackWidth } from './gridLayout';

export function TimeHeader({ slots, labelWidth }: { slots: number[]; labelWidth: number }) {
  return (
    <div
      className="time-header"
      style={{ width: labelWidth + trackWidth(slots.length), gridTemplateColumns: `${labelWidth}px 1fr` }}
    >
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
