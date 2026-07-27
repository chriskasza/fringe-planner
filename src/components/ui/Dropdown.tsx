import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './Dropdown.module.css';

type DropdownProps = {
  open: boolean;
  title: string;
  width: number;
  onClose: () => void;
  children: ReactNode;
};

// Positioned panel for filter menus. Esc closes; focus moves into the panel
// on open so Tab stays inside it while it's up. Clicks outside are handled by
// FilterBar, which tests containment against its own container - the panel
// renders inside it, so no marker attribute is involved.
export function Dropdown({ open, title, width, onClose, children }: DropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      onClose();
    }
    function onFocusTrap(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keydown', onFocusTrap);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keydown', onFocusTrap);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={styles.dropdown}
      style={{ width }}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
    >
      <div className={styles['dropdown__title']}>{title}</div>
      {children}
    </div>
  );
}
