import { useApp } from '../../state/AppContext';
import './DayStrip.css';

export function DayStrip() {
  const { state, dispatch, days } = useApp();

  return (
    <div className="day-strip">
      {days.map((d) => {
        const selected = state.gridDay === d.key;
        const dimmed = !state.daysOn[d.key];
        return (
          <button
            key={d.key}
            type="button"
            className={`day-strip__tab ${selected ? 'day-strip__tab--selected' : ''}`}
            style={dimmed ? { opacity: 0.5 } : undefined}
            onClick={() => dispatch({ type: 'SET_GRID_DAY', day: d.key })}
          >
            <span className={`day-strip__dow ${selected ? 'day-strip__dow--selected' : ''}`}>{d.dow}</span>
            <span className="day-strip__num">{d.dateNum}</span>
            <span className="day-strip__count">{d.count} shows</span>
          </button>
        );
      })}
    </div>
  );
}
