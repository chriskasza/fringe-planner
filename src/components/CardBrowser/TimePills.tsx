import { useApp } from '../../state/AppContext';
import { perfInFilter, perfKey, perfState } from '../../lib/derived';
import { formatTime } from '../../lib/dates';
import { Pill } from '../ui/Pill';
import type { Show } from '../../lib/types';
import './TimePills.css';

// One pill per performance within the current date/time filter, sorted by
// day then time. Clicking toggles that single performance.
export function TimePills({ show }: { show: Show }) {
  const { state, dispatch, shows, days } = useApp();

  const perfs = show.perfs
    .filter((p) => p.status === 'active' && perfInFilter(p, state.daysOn, state.timeBucketsOn))
    .sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);

  return (
    <div className="time-pills">
      {perfs.map((p) => {
        const key = perfKey(show.id, p.day, p.start);
        const pState = perfState(show, p, state.picked, shows);
        const day = days.find((d) => d.key === p.day);
        const dayLabel = day ? `${day.dow} ${day.dateNum}` : p.day;

        return (
          <Pill
            key={key}
            state={pState}
            onClick={() => dispatch({ type: 'TOGGLE_PICK', key })}
            ariaLabel={`${dayLabel} · ${formatTime(p.start)}, ${pState.replace('-', ' ')}`}
          >
            {dayLabel} · {formatTime(p.start)}
          </Pill>
        );
      })}
    </div>
  );
}
