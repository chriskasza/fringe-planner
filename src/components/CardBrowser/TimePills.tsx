import { useApp } from '../../state/AppContext';
import { isPlayed, notCancelled, perfInFilter, perfState } from '../../lib/derived';
import { useNow } from '../../lib/useNow';
import { formatTime } from '../../lib/dates';
import { Pill } from '../ui/Pill';
import type { Show } from '../../lib/types';
import styles from './TimePills.module.css';

// One pill per performance within the current date/time filter, sorted by
// day then time. Clicking toggles that single performance.
export function TimePills({ show }: { show: Show }) {
  const { state, dispatch, shows, days } = useApp();
  const now = useNow();

  const perfs = show.perfs
    .filter((p) => notCancelled(p) && perfInFilter(p, state.daysOn, state.timeBucketsOn))
    .sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);

  return (
    <div className={styles['time-pills']}>
      {perfs.map((p) => {
        const timeId = p.timeId;
        const pState = perfState(show, p, state.picked, shows);
        const played = isPlayed(p, now);
        const day = days.find((d) => d.key === p.day);
        const dayLabel = day ? `${day.dow} ${day.dateNum}` : p.day;

        return (
          <Pill
            key={timeId}
            state={pState}
            played={played}
            onClick={() => dispatch({ type: 'TOGGLE_PICK', timeId })}
            // The hatch can't reach assistive tech, so the label carries it -
            // same wording as the grid block's.
            ariaLabel={`${dayLabel} · ${formatTime(p.start)}, ${pState.replace('-', ' ')}${played ? ', ended' : ''}`}
          >
            {dayLabel} · {formatTime(p.start)}
          </Pill>
        );
      })}
    </div>
  );
}
