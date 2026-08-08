import styles from './IconButton.module.css';

type IconButtonProps = {
  glyph: string;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  variant?: 'default' | 'on-gold';
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
  // Visual size stays whatever the caller asked for, but the tappable area
  // is padded out to the 44px touch-target minimum via a ::after (see
  // IconButton.module.css) - hitInset is that pad's width on each side.
  const hitInset = Math.max(0, (44 - size) / 2);

  return (
    <button
      type="button"
      className={`${styles['icon-button']} ${styles[`icon-button--${variant}`]} ${className}`}
      style={{ width: size, height: size, '--icon-hit-inset': `${hitInset}px` } as React.CSSProperties}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {glyph}
    </button>
  );
}
