import styles from './IconButton.module.css';

type IconButtonProps = {
  glyph: string;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  variant?: 'default' | 'on-gold' | 'star-picked' | 'star-unpicked';
  size?: number;
  className?: string;
};

export function IconButton({
  glyph,
  onClick,
  ariaLabel,
  variant = 'default',
  size = 18,
  className = '',
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`${styles['icon-button']} ${styles[`icon-button--${variant}`]} ${className}`}
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
