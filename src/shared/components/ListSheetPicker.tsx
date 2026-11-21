'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { SearchField } from '@/design-system';
import { Check, X as Ban } from '@/design-system/icons';
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
        searchable ? <SearchField value={query} onValueChange={setQuery} placeholder="جستجو" aria-label="جستجو" autoFocus /> : undefined
      }
    >
      <div className="space-y-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => commit(null)}
            className={`ds-focus w-full flex items-center gap-3 rounded-control p-3 text-start transition-colors ${
              value === null
                ? 'bg-accent-soft'
                : 'bg-panel hover:bg-hover'
            }`}
          >
            <span className={value === null ? 'text-accent-ink' : 'text-fg-subtle'}>
              {noneLeading ?? <Ban size={14} />}
            </span>
            <span
              className={`flex-1 min-w-0 text-callout truncate ${
                value === null ? 'text-fg font-semibold' : 'text-fg'
              }`}
            >
              {noneLabel}
            </span>
            {value === null && (
              <Check size={14} className="text-accent-ink shrink-0" />
            )}
          </button>
        )}

        {filtered.length === 0 ? (
          <p className="text-caption text-fg-subtle py-8 text-center">{emptyLabel}</p>
        ) : (
          filtered.map((it) => {
            const selected = value === it.id;
            return (
              <button
                key={it.id}
                type="button"
                disabled={it.disabled}
                onClick={() => commit(it.id)}
                className={`ds-focus w-full flex items-center gap-3 rounded-control p-3 text-start transition-colors ${
                  selected
                    ? 'bg-accent-soft'
                    : 'bg-panel hover:bg-hover'
                } ${it.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {it.leading && (
                  <span
                    className={`shrink-0 ${
                      selected ? 'text-accent-ink' : 'text-fg-subtle'
                    }`}
                  >
                    {it.leading}
                  </span>
                )}
                <div className="flex-1 min-w-0 text-right">
                  <div
                    className={`text-callout truncate ${
                      selected ? 'text-fg font-semibold' : 'text-fg'
                    }`}
                  >
                    {it.label}
                  </div>
                  {it.sublabel && (
                    <div className="text-caption text-fg-subtle truncate mt-0.5">
                      {it.sublabel}
                    </div>
                  )}
                </div>
                {it.trailing}
                {selected && (
                  <Check size={14} className="text-accent-ink shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}
