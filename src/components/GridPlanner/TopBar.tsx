import type { ReactNode } from 'react';
import { useApp } from '../../state/AppContext';
import { onNowCount } from '../../lib/derived';
import { SegmentedControl } from '../ui/SegmentedControl';
import './TopBar.css';

type TopBarProps = {
  compact?: boolean;
  rightExtra?: ReactNode;
};

export function TopBar({ compact = false, rightExtra }: TopBarProps) {
  const { state, dispatch, shows } = useApp();
  const onNow = onNowCount(shows);

  return (
    <div className={`topbar ${compact ? 'topbar--compact' : ''}`}>
      <div className="topbar__brand">
        {/* Collapsed to initials on mobile so Filters + My Fringe both fit on one line. */}
        <span className="topbar__wordmark">{compact ? 'HF' : 'HALIFAX FRINGE'}</span>
        {!compact && <span className="topbar__tagline">SHOW SELECTOR · 2026</span>}
      </div>
      <div className="topbar__right">
        {!compact && (
          <span className="topbar__onnow">
            <span className="topbar__onnow-dot" />
            ON NOW: {onNow} SHOW{onNow === 1 ? '' : 'S'}
          </span>
        )}
        <SegmentedControl
          value={state.viewMode}
          onChange={(view) => dispatch({ type: 'SET_VIEW', view })}
          options={[
            { value: 'cards', label: 'Cards' },
            { value: 'grid', label: 'Grid' },
          ]}
        />
        {rightExtra}
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
