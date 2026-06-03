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
      className="w-9 h-9 rounded-xl bg-[#1A1B26] border border-white/5 flex items-center justify-center text-slate-300 hover:bg-white/5 hover:text-white transition disabled:opacity-40 disabled:pointer-events-none"
    >
      <Download size={16} />
    </button>
  );
}
