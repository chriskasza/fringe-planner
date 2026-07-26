import { useApp } from '../../../state/AppContext';
import { perfKey, perfState } from '../../../lib/derived';
import type { Show } from '../../../lib/types';

export function TimelineCard({ show, perf }: { show: Show; perf: Show['perfs'][number] }) {
  const { state, dispatch, shows } = useApp();
  const key = perfKey(show.id, perf.day, perf.start);
  const pState = perfState(show, perf, state.picked, shows);
  const isPicked = pState === 'picked' || pState === 'picked-clash';

  return (
    <div
      className={`timeline-card timeline-card--${pState}`}
      onClick={() => dispatch({ type: 'TOGGLE_PICK', key })}
    >
      <div className="timeline-card__top">
        <span className="timeline-card__title">{show.title}</span>
        <span className="timeline-card__star">{isPicked ? '★' : '☆'}</span>
      </div>
      <div className="timeline-card__meta">
        {show.venueShort} · {perf.mins} MIN
      </div>
    </div>
  );
}
