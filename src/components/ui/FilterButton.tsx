import { forwardRef } from 'react';
import './FilterButton.css';

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
      className={`filter-button ${active ? 'filter-button--active' : 'filter-button--idle'}`}
      onClick={onClick}
    >
      <span className="filter-button__label">{label}</span>
      <span className="filter-button__sep"> · </span>
      <span className="filter-button__value">{value}</span>
      <span className="filter-button__caret">▾</span>
    </button>
  ),
);
FilterButton.displayName = 'FilterButton';
