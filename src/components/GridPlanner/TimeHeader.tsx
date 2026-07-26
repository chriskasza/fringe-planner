import { formatTime } from '../../lib/dates';

export function TimeHeader({ slots }: { slots: number[] }) {
  return (
    <div className="time-header">
      <div className="time-header__spacer" />
      <div className="time-header__track" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0,1fr))` }}>
        {slots.map((s) => (
          <div key={s} className="time-header__label">
            {formatTime(s)}
          </div>
        ))}
      </div>
    </div>
  );
}
