import styles from './CheckboxRow.module.css';

type CheckboxRowProps = {
  label: string;
  checked: boolean;
  count?: number;
  dimmed?: boolean;
  onChange: () => void;
};

export function CheckboxRow({ label, checked, count, dimmed, onChange }: CheckboxRowProps) {
  return (
    <label className={`${styles['checkbox-row']} ${dimmed ? styles['checkbox-row--dimmed'] : ''}`}>
      <span
        className={`${styles['checkbox-row__box']} ${checked ? styles['checkbox-row__box--checked'] : ''}`}
        aria-hidden="true"
      >
        {checked ? '✓' : ''}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={styles['checkbox-row__input']}
      />
      <span className={styles['checkbox-row__label']}>{label}</span>
      {count !== undefined && <span className={styles['checkbox-row__count']}>{count}</span>}
    </label>
  );
}
