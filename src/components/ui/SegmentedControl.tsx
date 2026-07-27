import styles from './SegmentedControl.module.css';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.segmented}>
      {label && <span className={styles['segmented__label']}>{label}</span>}
      <div className={styles['segmented__options']}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles['segmented__option']} ${value === opt.value ? styles['segmented__option--selected'] : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
