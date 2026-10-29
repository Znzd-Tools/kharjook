'use client';

import { Search, X } from 'lucide-react';

export function TransactionHistorySearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="جستجو در یادداشت، دسته، مبلغ..."
        aria-label="جستجو در تاریخچه تراکنش‌ها"
        className="w-full h-10 bg-white/5 border border-transparent rounded-xl pr-9 pl-9 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-white/10 focus:bg-surface-raised outline-none transition-colors"
      />
      {value.trim().length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
          aria-label="پاک کردن جستجو"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
