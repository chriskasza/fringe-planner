import styles from './Typography.module.css';
import type { ReactNode } from 'react';

export function MonoLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`${styles['mono-label']} ${className}`}>{children}</span>;
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`${styles['section-label']} ${className}`}>{children}</span>;
}
