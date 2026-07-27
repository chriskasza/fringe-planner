import styles from './Pill.module.css';
import type { PerfState } from '../../lib/derived';

type PillProps = {
  state: PerfState;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
};

export function Pill({ state, children, onClick, ariaLabel }: PillProps) {
  return (
    <button
      type="button"
      className={`${styles.pill} ${styles[`pill--${state}`]}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
