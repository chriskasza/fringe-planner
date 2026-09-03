import styles from './Pill.module.css';
import type { PerfState } from '../../lib/derived';

type PillProps = {
  state: PerfState;
  // Orthogonal to `state`, exactly as on a grid block: the hatch layers over
  // whichever of the four state rules applies, so the cue reads the same on a
  // gold picked pill and a sunken free one. Not folded into PerfState, which
  // dayRailState and the grid both mirror.
  played?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
};

export function Pill({ state, played = false, children, onClick, ariaLabel }: PillProps) {
  return (
    <button
      type="button"
      className={[styles.pill, styles[`pill--${state}`], played ? styles['pill--played'] : '']
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
