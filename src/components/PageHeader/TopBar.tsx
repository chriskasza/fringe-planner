import { useApp } from '../../state/AppContext';
import segmentedStyles from '../ui/SegmentedControl.module.css';
import styles from './TopBar.module.css';

export function TopBar() {
  const { state, dispatch } = useApp();

  // A switch, not a real segmented control (SegmentedControl sets state to
  // whichever option was clicked - see its use for Overlaps below). Both
  // Grid and Cards labels stay visible so it reads as "there are two views,"
  // but *either* side dispatches the same flip: clicking the already-active
  // side still switches away from it, the same as clicking the inactive
  // side would. That's deliberate, not reused SegmentedControl semantics -
  // with exactly two states, "click a side to select it" and "click either
  // side to flip" only disagree when you click the side that's already
  // active, and the flip behavior is what was asked for there.
  const nextView = state.viewMode === 'grid' ? 'cards' : 'grid';

  return (
    <div data-testid="topbar" className={styles.topbar}>
      <div className={styles['topbar__brand']}>
        {/* "Halifax" drops first (CSS, under 700px) so the view toggle + My
            Fringe still fit on one line; "Planner" drops next (CSS, under
            520px) for phones too narrow for even "Fringe Planner". Both
            words stay in the DOM at every width - jsdom always sees the full
            text, CSS alone decides what's visible. */}
        <span data-testid="topbar-wordmark" className={styles['topbar__wordmark']}>
          <span className={styles['topbar__wordmark-prefix']}>Halifax </span>
          Fringe
          <span className={styles['topbar__wordmark-planner']}> Planner</span>
        </span>
      </div>
      <div className={styles['topbar__right']}>
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
          onClick={() => dispatch({ type: 'SET_MY_FRINGE_OPEN', open: !state.myFringeOpen })}
        >
          My Fringe
          <span
            // Remounting on every pickPulse change restarts the CSS
            // animation each time (a plain class toggle wouldn't replay it
            // for back-to-back picks, since the class name never actually
            // changes). pickPulse starts at 0, so --pop is never applied on
            // initial mount.
            key={state.pickPulse}
            data-testid="topbar-myfringe-badge"
            className={`${styles['topbar__badge']} ${state.pickPulse > 0 ? styles['topbar__badge--pop'] : ''}`}
          >
            {state.picked.size}
          </span>
        </button>
      </div>
    </div>
  );
}
