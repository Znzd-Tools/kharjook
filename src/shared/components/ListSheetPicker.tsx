'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Ban, Check, Search } from 'lucide-react';
import { BottomSheet } from '@/shared/components/BottomSheet';
import { haptic } from '@/shared/utils/haptics';

export interface ListSheetPickerItem {
  id: string;
  label: string;
  /** Optional secondary text rendered under the label. */
  sublabel?: string;
  /** Optional leading icon/ornament. */
  leading?: ReactNode;
  /** Optional trailing badge (e.g. tag, chip). */
  trailing?: ReactNode;
  /** When true, row is rendered but not selectable. */
  disabled?: boolean;
}

export interface ListSheetPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: ListSheetPickerItem[];
  value: string | null;
  onSelect: (id: string | null) => void;
  /** When true, adds a row that selects `null`. */
  allowNone?: boolean;
  /** Label for the "none" row. */
  noneLabel?: string;
  /** Leading icon for the "none" row. Defaults to a Ban glyph. */
  noneLeading?: ReactNode;
  /** Hide the search input for short lists. */
  searchable?: boolean;
  /** Message when items + query yield nothing. */
  emptyLabel?: string;
}

export function ListSheetPicker({
  open,
  onClose,
  title,
  items,
  value,
  onSelect,
  allowNone = false,
  noneLabel = '— بدون انتخاب —',
  noneLeading,
  searchable = true,
  emptyLabel = 'موردی یافت نشد.',
}: ListSheetPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.sublabel?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  const commit = (id: string | null) => {
    haptic('selection');
    onSelect(id);
    onClose();
    setQuery('');
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        onClose();
        setQuery('');
      }}
      title={title}
      header={
        searchable ? (
          <div className="relative">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو..."
              className="w-full bg-surface-raised border border-white/10 rounded-xl py-2.5 pr-9 pl-3 text-sm text-white placeholder:text-zinc-500 focus:border-accent-500 outline-none"
              autoFocus
            />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => commit(null)}
            className={`w-full flex items-center gap-3 border rounded-xl p-3 text-right transition active:scale-[0.98] ${
              value === null
                ? 'bg-accent-500/10 border-accent-500/40'
                : 'bg-surface-raised border-white/5 hover:bg-surface-hover'
            }`}
          >
            <span className={value === null ? 'text-accent-300' : 'text-zinc-500'}>
              {noneLeading ?? <Ban size={14} />}
            </span>
            <span
              className={`flex-1 min-w-0 text-sm truncate ${
                value === null ? 'text-white font-semibold' : 'text-zinc-200'
              }`}
            >
              {noneLabel}
            </span>
            {value === null && (
              <Check size={14} className="text-accent-300 shrink-0" />
            )}
          </button>
        )}

        {filtered.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">{emptyLabel}</p>
        ) : (
          filtered.map((it) => {
            const selected = value === it.id;
            return (
              <button
                key={it.id}
                type="button"
                disabled={it.disabled}
                onClick={() => commit(it.id)}
                className={`w-full flex items-center gap-3 border rounded-xl p-3 text-right transition active:scale-[0.98] ${
                  selected
                    ? 'bg-accent-500/10 border-accent-500/40'
                    : 'bg-surface-raised border-white/5 hover:bg-surface-hover'
                } ${it.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {it.leading && (
                  <span
                    className={`shrink-0 ${
                      selected ? 'text-accent-300' : 'text-zinc-500'
                    }`}
                  >
                    {it.leading}
                  </span>
                )}
                <div className="flex-1 min-w-0 text-right">
                  <div
                    className={`text-sm truncate ${
                      selected ? 'text-white font-semibold' : 'text-zinc-200'
                    }`}
                  >
                    {it.label}
                  </div>
                  {it.sublabel && (
                    <div className="text-xs text-zinc-500 truncate mt-0.5">
                      {it.sublabel}
                    </div>
                  )}
                </div>
                {it.trailing}
                {selected && (
                  <Check size={14} className="text-accent-300 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}
