import { useApp } from '../../state/AppContext';
import { perfKey, perfState } from '../../lib/derived';
import { formatTime } from '../../lib/dates';
import { columnFor, spanFor } from './gridLayout';
import { IconButton } from '../ui/IconButton';
import type { Show } from '../../lib/types';

type GridBlockProps = {
  show: Show;
  perf: Show['perfs'][number];
  gridStartMin: number;
};

export function GridBlock({ show, perf, gridStartMin }: GridBlockProps) {
  const { state, dispatch, shows } = useApp();
  const key = perfKey(show.id, perf.day, perf.start);
  const pState = perfState(show, perf, state.picked, shows);

  const style: React.CSSProperties = {
    gridColumn: `${columnFor(perf.start, gridStartMin)} / span ${spanFor(perf.mins)}`,
    gridRow: 1,
  };

  return (
    <div
      className={`grid-block grid-block--${pState}`}
      style={style}
      onClick={() => dispatch({ type: 'TOGGLE_PICK', key })}
    >
      <div className="grid-block__top">
        <span className="grid-block__title">{show.title}</span>
        <IconButton
          glyph="ⓘ"
          ariaLabel={`Details for ${show.title}`}
          variant={pState === 'picked' || pState === 'picked-clash' ? 'on-gold' : 'default'}
          size={18}
          onClick={() => dispatch({ type: 'SET_DETAIL', detail: { showId: show.id, perfKey: key } })}
        />
      </div>
      <div className="grid-block__meta">
        {formatTime(perf.start)} · {perf.mins} MIN
      </div>
    </div>
  );
}
