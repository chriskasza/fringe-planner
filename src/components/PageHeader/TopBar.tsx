import { useApp } from '../../state/AppContext';
import { onNowCount } from '../../lib/derived';
import { useNow } from '../../lib/useNow';
import segmentedStyles from '../ui/SegmentedControl.module.css';
import styles from './TopBar.module.css';

type TopBarProps = {
  compact?: boolean;
};

export function TopBar({ compact = false }: TopBarProps) {
  const { state, dispatch, shows } = useApp();
  const now = useNow();
  const onNow = onNowCount(shows, now);

  // A switch, not a real segmented control (SegmentedControl sets state to
  // whichever option was clicked - see its use for Conflicts below). Both
  // Grid and Cards labels stay visible so it reads as "there are two views,"
  // but *either* side dispatches the same flip: clicking the already-active
  // side still switches away from it, the same as clicking the inactive
  // side would. That's deliberate, not reused SegmentedControl semantics -
  // with exactly two states, "click a side to select it" and "click either
  // side to flip" only disagree when you click the side that's already
  // active, and the flip behavior is what was asked for there.
  const nextView = state.viewMode === 'grid' ? 'cards' : 'grid';

  return (
    <div data-testid="topbar" className={`${styles.topbar} ${compact ? styles['topbar--compact'] : ''}`}>
      <div className={styles['topbar__brand']}>
        {/* "Halifax" drops first (mobile tree) so the view toggle + My Fringe
            still fit on one line; "Planner" drops next (CSS, under 520px)
            for phones too narrow for even "Fringe Planner". */}
        <span data-testid="topbar-wordmark" className={styles['topbar__wordmark']}>
          {compact ? 'Fringe' : 'Halifax Fringe'}
          <span className={styles['topbar__wordmark-planner']}> Planner</span>
        </span>
      </div>
      <div className={styles['topbar__right']}>
        {!compact && onNow > 0 && (
          <span className={styles['topbar__onnow']}>
            <span className={styles['topbar__onnow-dot']} />
            ON NOW: {onNow} SHOW{onNow === 1 ? '' : 'S'}
          </span>
        )}
        <div className={segmentedStyles.segmented}>
          <div className={segmentedStyles['segmented__options']}>
            <button
              type="button"
              className={`${segmentedStyles['segmented__option']} ${state.viewMode === 'grid' ? segmentedStyles['segmented__option--selected'] : ''}`}
              onClick={() => dispatch({ type: 'SET_VIEW', view: nextView })}
            >
              Grid
            </button>
            <button
              type="button"
              className={`${segmentedStyles['segmented__option']} ${state.viewMode === 'cards' ? segmentedStyles['segmented__option--selected'] : ''}`}
              onClick={() => dispatch({ type: 'SET_VIEW', view: nextView })}
            >
              Cards
            </button>
          </div>
        </div>
        <button
          type="button"
          className={styles['topbar__myfringe']}
          onClick={() => dispatch({ type: 'SET_SYNC_OPEN', open: true })}
        >
          My Fringe
          <span className={styles['topbar__badge']}>{state.picked.size}</span>
        </button>
      </div>
    </div>
  );
}
