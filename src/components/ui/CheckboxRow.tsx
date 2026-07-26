import './CheckboxRow.css';

type CheckboxRowProps = {
  label: string;
  checked: boolean;
  count?: number;
  dimmed?: boolean;
  onChange: () => void;
};

export function CheckboxRow({ label, checked, count, dimmed, onChange }: CheckboxRowProps) {
  return (
    <label className={`checkbox-row ${dimmed ? 'checkbox-row--dimmed' : ''}`}>
      <span
        className={`checkbox-row__box ${checked ? 'checkbox-row__box--checked' : ''}`}
        aria-hidden="true"
      >
        {checked ? '✓' : ''}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="checkbox-row__input"
      />
      <span className="checkbox-row__label">{label}</span>
      {count !== undefined && <span className="checkbox-row__count">{count}</span>}
    </label>
  );
}
