'use client';

/**
 * Old bottom-sheet API, kept for the pickers built on it. It now renders the
 * design-system `Sheet`, so they look and swipe like every other sheet.
 * New code: `Sheet` from '@/design-system'.
 */
import type { ReactNode } from 'react';
import { Sheet } from '@/design-system';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Content under the title that does not scroll (e.g. a search field). */
  header?: ReactNode;
  children: ReactNode;
  /** Kept for API compatibility; the design-system sheet always swipes down to close. */
  dismissOnDrag?: boolean;
}

export function BottomSheet({ open, onClose, title, header, children }: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title} header={header}>
      {children}
    </Sheet>
  );
}
