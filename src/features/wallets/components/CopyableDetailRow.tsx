'use client';

import { useState } from 'react';
import { ListRow, toast } from '@/design-system';
import { Check, Copy } from '@/design-system/icons';

export interface CopyableDetailRowProps {
  label: string;
  value: string;
  /** Raw string copied to clipboard (defaults to `value`). */
  copyValue?: string;
  /** Text direction for the value line. */
  valueDir?: 'ltr' | 'rtl' | 'auto';
}

/** One tap copies the value. Use inside a design-system `List`. */
export function CopyableDetailRow({ label, value, copyValue, valueDir = 'ltr' }: CopyableDetailRowProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      toast.success('کپی شد');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('کپی نشد');
    }
  };

  return (
    <ListRow
      onClick={() => void copy()}
      chevron={false}
      aria-label={`کپی ${label}`}
      title={<span className="text-caption text-fg-subtle">{label}</span>}
      subtitle={
        <span className="block truncate text-callout font-medium text-fg tabular" dir={valueDir}>
          {value}
        </span>
      }
      trailing={copied ? <Check className="size-4 text-positive-ink" /> : <Copy className="size-4 text-fg-subtle" />}
    />
  );
}
