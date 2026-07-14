'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface ModalProps {
  children: ReactNode;
  /** Accessible label for the modal. */
  label?: string;
}

export function Modal({ children, label = 'پنجره' }: ModalProps) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="absolute inset-0 z-50 bg-surface-inset overflow-y-auto overflow-x-hidden scrollbar-hide outline-none"
    >
      {children}
    </div>
  );
}
