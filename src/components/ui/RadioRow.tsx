import styles from './RadioRow.module.css';

type RadioRowProps = {
  label: string;
  selected: boolean;
  onSelect: () => void;
};

// Single-select sibling of CheckboxRow - a dot instead of a checkbox square,
// a real <button> instead of a checkbox input, and picking an option is
// expected to close the menu rather than leave it open for further toggling.
export function RadioRow({ label, selected, onSelect }: RadioRowProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      className={styles['radio-row']}
      onClick={onSelect}
    >
      <span
        className={`${styles['radio-row__dot']} ${selected ? styles['radio-row__dot--selected'] : ''}`}
        aria-hidden="true"
      />
      <span className={styles['radio-row__label']}>{label}</span>
    </button>
  );
}
