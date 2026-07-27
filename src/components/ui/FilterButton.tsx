import { forwardRef } from 'react';
import styles from './FilterButton.module.css';

type FilterButtonProps = {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
};

export const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(
  ({ label, value, active, onClick }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`${styles['filter-button']} ${active ? styles['filter-button--active'] : styles['filter-button--idle']}`}
      onClick={onClick}
    >
      <span className={styles['filter-button__label']}>{label}</span>
      <span className={styles['filter-button__sep']}> · </span>
      <span className={styles['filter-button__value']}>{value}</span>
      <span className={styles['filter-button__caret']}>▾</span>
    </button>
  ),
);
FilterButton.displayName = 'FilterButton';
