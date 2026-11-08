'use client';

import { DateWheel, Sheet } from '@/design-system';


export interface IOSDatePickerProps {
  open: boolean;
  onClose: () => void;
  /** Canonical `YYYY/MM/DD` Jalali string. */
  value: string;
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
}

/** Old API, same wheel as the design system DateField (one picker everywhere). */
export function IOSDatePicker({ open, onClose, value, onChange, minYear, maxYear }: IOSDatePickerProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="انتخاب تاریخ">
      {open && (
        <DateWheel
          value={value}
          minYear={minYear}
          maxYear={maxYear}
          onConfirm={(v) => {
            onChange(v);
            onClose();
          }}
          onCancel={onClose}
        />
      )}
    </Sheet>
  );
}
