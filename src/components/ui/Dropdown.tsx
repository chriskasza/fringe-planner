import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createFocusTrap } from 'focus-trap';
import styles from './Dropdown.module.css';

type DropdownProps = {
  open: boolean;
  title: string;
  width: number;
  onClose: () => void;
  children: ReactNode;
};

// Positioned panel for filter menus. Esc closes; focus moves into the panel
// on open so Tab stays inside it while it's up - both handled by focus-trap
// rather than hand-rolled, since this is accessibility-critical code a
// well-used library gets right more reliably than a bespoke Tab/Shift-Tab
// wraparound. Clicks outside are handled by FilterBar, which tests
// containment against its own container - the panel renders inside it, so
// the trap is told to leave outside clicks alone (allowOutsideClick) rather
// than deactivate on them itself.
export function Dropdown({ open, title, width, onClose, children }: DropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // FilterBar passes a fresh onClose closure every render (it dispatches
  // inline), so reading it through a ref rather than putting it in the
  // effect's own deps keeps the trap from tearing down and rebuilding -
  // re-stealing focus back to the panel - on every unrelated app re-render
  // while a dropdown happens to be open.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;

    const trap = createFocusTrap(panelRef.current, {
      // Matches the old behavior of focusing the dialog container itself,
      // not its first control.
      initialFocus: () => panelRef.current!,
      fallbackFocus: () => panelRef.current!,
      // focus-trap defaults to delaying initial focus by a frame, to avoid
      // capturing the click that opened the trap. That click always lands on
      // FilterButton, outside this panel, so the delay just adds latency the
      // old synchronous `panelRef.current?.focus()` never had.
      delayInitialFocus: false,
      escapeDeactivates: true,
      clickOutsideDeactivates: false,
      allowOutsideClick: true,
      onDeactivate: () => onCloseRef.current(),
    });
    trap.activate();
    return () => {
      // A plain trap.deactivate() here would re-fire onDeactivate even when
      // this cleanup runs because React itself closed this dropdown (e.g. a
      // different filter just opened) - that stray onClose lands a tick
      // after the new dropdown already opened and closes it right back.
      // Overriding onDeactivate to a no-op for just this call suppresses
      // that (focus-trap only skips the call for null/undefined, not falsy
      // values in general, so `false` here would throw - it has to be a
      // function). Escape-to-close still works: it's handled by
      // escapeDeactivates internally calling the trap's own deactivate()
      // with no override, which keeps the configured onDeactivate.
      trap.deactivate({ onDeactivate: () => {} });
    };
  }, [open]);

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
