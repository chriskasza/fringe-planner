import './IconButton.css';

type IconButtonProps = {
  glyph: string;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  variant?: 'default' | 'on-gold' | 'star-picked' | 'star-unpicked';
  size?: number;
};

export function IconButton({
  glyph,
  onClick,
  ariaLabel,
  variant = 'default',
  size = 18,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button icon-button--${variant}`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={ariaLabel}
    >
      {glyph}
    </button>
  );
}
