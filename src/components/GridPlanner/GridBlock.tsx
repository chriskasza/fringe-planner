import { useApp } from '../../state/AppContext';
import { perfState } from '../../lib/derived';
import { formatTime } from '../../lib/dates';
import { blockLeft, blockWidth, BLOCK_INSET_Y_PX } from './gridLayout';
import { IconButton } from '../ui/IconButton';
import type { Show } from '../../lib/types';
import styles from './GridPlanner.module.css';

type GridBlockProps = {
  show: Show;
  perf: Show['perfs'][number];
  gridStartMin: number;
};

export function GridBlock({ show, perf, gridStartMin }: GridBlockProps) {
  const { state, dispatch, shows } = useApp();
  const timeId = perf.timeId;
  const pState = perfState(show, perf, state.picked, shows);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: blockLeft(perf.start, gridStartMin),
    width: blockWidth(perf.mins),
    top: BLOCK_INSET_Y_PX,
    bottom: BLOCK_INSET_Y_PX,
  };

  const stateLabel =
    pState === 'picked' || pState === 'picked-clash' ? 'Picked' : pState === 'clash' ? 'Overlaps' : 'Available';

  return (
    <div data-testid="grid-block" className={styles['grid-block']} style={style}>
      <button
        type="button"
        data-testid="grid-block-pick"
        className={`${styles['grid-block__surface']} ${styles[`grid-block__surface--${pState}`]}`}
        onClick={() => dispatch({ type: 'TOGGLE_PICK', timeId })}
        aria-label={`${show.title}, ${formatTime(perf.start)}, ${perf.mins} min, ${stateLabel}`}
      >
        <div className={styles['grid-block__top']}>
          <span className={styles['grid-block__title']} title={show.title}>
            {show.title}
          </span>
        </div>
        <div className={styles['grid-block__meta']}>
          {formatTime(perf.start)} · {perf.mins} MIN
        </div>
      </button>
      <IconButton
        glyph="ⓘ"
        ariaLabel={`Details for ${show.title}`}
        variant={pState === 'picked' || pState === 'picked-clash' ? 'on-gold' : 'default'}
        size={18}
        className={styles['grid-block__icon']}
        onClick={() => dispatch({ type: 'SET_DETAIL', detail: state.detail?.timeId === timeId ? null : { timeId } })}
      />
    </div>
  );
}
