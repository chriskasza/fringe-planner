import { useApp } from '../../state/AppContext';
import { onNowCount } from '../../lib/derived';
import './TopBar.css';

export function TopBar() {
  const { state, dispatch, shows } = useApp();
  const onNow = onNowCount(shows);

  return (
    <div className="topbar">
      <div className="topbar__brand">
        <span className="topbar__wordmark">HALIFAX FRINGE</span>
        <span className="topbar__tagline">SHOW SELECTOR · 2026</span>
      </div>
      <div className="topbar__right">
        <span className="topbar__onnow">
          <span className="topbar__onnow-dot" />
          ON NOW: {onNow} SHOW{onNow === 1 ? '' : 'S'}
        </span>
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
