import { useApp } from '../../state/AppContext';
import { onNowCount } from '../../lib/derived';
import { useNow } from '../../lib/useNow';
import '../ui/SegmentedControl.css';
import './TopBar.css';

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
    <div className={`topbar ${compact ? 'topbar--compact' : ''}`}>
      <div className="topbar__brand">
        {/* "Halifax" drops first (mobile tree) so the view toggle + My Fringe
            still fit on one line; "Planner" drops next (CSS, under 520px)
            for phones too narrow for even "Fringe Planner". */}
        <span className="topbar__wordmark">
          {compact ? 'Fringe' : 'Halifax Fringe'}
          <span className="topbar__wordmark-planner"> Planner</span>
        </span>
      </div>
      <div className="topbar__right">
        {!compact && onNow > 0 && (
          <span className="topbar__onnow">
            <span className="topbar__onnow-dot" />
            ON NOW: {onNow} SHOW{onNow === 1 ? '' : 'S'}
          </span>
        )}
        <div className="segmented">
          <div className="segmented__options">
            <button
              type="button"
              className={`segmented__option ${state.viewMode === 'grid' ? 'segmented__option--selected' : ''}`}
              onClick={() => dispatch({ type: 'SET_VIEW', view: nextView })}
            >
              Grid
            </button>
            <button
              type="button"
              className={`segmented__option ${state.viewMode === 'cards' ? 'segmented__option--selected' : ''}`}
              onClick={() => dispatch({ type: 'SET_VIEW', view: nextView })}
            >
              Cards
            </button>
          </div>
        </div>
        <button
          type="button"
          className="topbar__myfringe"
          onClick={() => dispatch({ type: 'SET_SYNC_OPEN', open: true })}
        >
          My Fringe
          <span className="topbar__badge">{state.picked.size}</span>
        </button>
      </div>
    </div>
  );
}
