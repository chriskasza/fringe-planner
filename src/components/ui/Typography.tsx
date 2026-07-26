import './Typography.css';
import type { ReactNode } from 'react';

export function MonoLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`mono-label ${className}`}>{children}</span>;
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`section-label ${className}`}>{children}</span>;
}
