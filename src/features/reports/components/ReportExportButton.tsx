'use client';

import { Download } from 'lucide-react';

export function ReportExportButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="خروجی CSV"
      title="خروجی CSV"
      className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/6 hover:text-white transition disabled:opacity-40 disabled:pointer-events-none"
    >
      <Download size={16} />
    </button>
  );
}
