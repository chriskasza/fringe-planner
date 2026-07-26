import './SegmentedControl.css';

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
    <div className="segmented">
      {label && <span className="segmented__label">{label}</span>}
      <div className="segmented__options">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`segmented__option ${value === opt.value ? 'segmented__option--selected' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
