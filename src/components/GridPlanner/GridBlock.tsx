import { useApp } from '../../state/AppContext';
import { perfState } from '../../lib/derived';
import { formatTime } from '../../lib/dates';
import { blockLeft, blockWidth, BLOCK_INSET_Y_PX, SLOT_WIDTH } from './gridLayout';
import { IconButton } from '../ui/IconButton';
import type { Show } from '../../lib/types';
import styles from './GridPlanner.module.css';

type GridBlockProps = {
  show: Show;
  perf: Show['perfs'][number];
  gridStartMin: number;
  slotWidthPx?: number;
};

export function GridBlock({ show, perf, gridStartMin, slotWidthPx = SLOT_WIDTH }: GridBlockProps) {
  const { state, dispatch, shows } = useApp();
  const timeId = perf.timeId;
  const pState = perfState(show, perf, state.picked, shows);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: blockLeft(perf.start, gridStartMin, slotWidthPx),
    width: blockWidth(perf.mins, slotWidthPx),
    top: BLOCK_INSET_Y_PX,
    bottom: BLOCK_INSET_Y_PX,
  };

  const stateLabel =
    pState === 'picked' || pState === 'picked-clash' ? 'Picked' : pState === 'clash' ? 'Overlaps' : 'Available';

  return (
    <div data-testid="grid-block" className={styles['grid-block']} style={style}>
      {/* Full-size pick target, painted first so the sticky group below
          paints on top of it. Carries no visible content of its own - the
          aria-label alone is its accessible name - since its whole box is
          just the block's background/border color showing through wherever
          the sticky group's own pointer-events: none lets clicks fall
          through to it (see .grid-block__sticky). This, not a stopPropagation
          workaround, is what keeps the ⓘ button and the pick surface as two
          independent siblings rather than one nested inside the other. */}
      <button
        type="button"
        data-testid="grid-block-pick"
        className={`${styles['grid-block__surface']} ${styles[`grid-block__surface--${pState}`]}`}
        onClick={() => dispatch({ type: 'TOGGLE_PICK', timeId })}
        aria-label={`${show.title}, ${formatTime(perf.start)}, ${perf.mins} min, ${stateLabel}`}
      />
      {/* Pinned to the block's left edge via `position: sticky` so a block
          scrolled partly off the left still shows its icon, title and time
          (known limit: travel is bounded by blockWidth - 150px, see the CSS). */}
      <div className={`${styles['grid-block__sticky']} ${styles[`grid-block__sticky--${pState}`]}`}>
        <IconButton
          glyph="ⓘ"
          ariaLabel={`Details for ${show.title}`}
          variant={pState === 'picked' || pState === 'picked-clash' ? 'on-gold' : 'default'}
          size={18}
          className={styles['grid-block__icon']}
          onClick={() => dispatch({ type: 'SET_DETAIL', detail: state.detail?.timeId === timeId ? null : { timeId } })}
        />
        <div className={styles['grid-block__body']}>
          <span className={styles['grid-block__title']} title={show.title}>
            {show.title}
          </span>
          <div className={styles['grid-block__meta']}>
            {formatTime(perf.start)} · {perf.mins} min
          </div>
        </div>
      </div>
    </div>
  );
}
