'use client';

import { Check, ChevronDown } from '../icons';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlBox, useField } from './Field';
import { Sheet } from './Sheet';
import { SearchField } from './TextField';
import { EmptyState } from './EmptyState';

export interface PickerOption<T extends string = string> {
  value: T;
  label: string;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Group heading (options with the same group show together). */
  group?: string;
  /** Extra words for search (e.g. symbol, English name). */
  keywords?: string;
  disabled?: boolean;
}

export interface PickerSheetProps<T extends string = string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  options: PickerOption<T>[];
  value?: T | null;
  onValueChange: (value: T) => void;
  /** Show a search box. Default: when more than 8 options. */
  searchable?: boolean;
  /** Option values to pin on top under "اخیر". */
  recent?: T[];
  /** Extra footer, e.g. "+ کیف پول جدید". */
  footer?: ReactNode;
}

/** Choose one item from a long list (wallet, asset, category, person). */
export function PickerSheet<T extends string>({
  open,
  onOpenChange,
  title,
  options,
  value,
  onValueChange,
  searchable,
  recent,
  footer,
}: PickerSheetProps<T>) {
  const [query, setQuery] = useState('');
  const showSearch = searchable ?? options.length > 8;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? options.filter((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(q))
      : options;
    const map = new Map<string, PickerOption<T>[]>();
    if (!q && recent?.length) {
      const rec = recent.map((v) => options.find((o) => o.value === v)).filter(Boolean) as PickerOption<T>[];
      if (rec.length) map.set('اخیر', rec);
    }
    for (const o of filtered) {
      const g = o.group ?? '';
      map.set(g, [...(map.get(g) ?? []), o]);
    }
    return [...map.entries()];
  }, [options, query, recent]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setQuery('');
        onOpenChange(o);
      }}
      title={title}
      header={showSearch ? <SearchField value={query} onValueChange={setQuery} /> : undefined}
      footer={footer}
    >
      {groups.length === 0 || groups.every(([, items]) => items.length === 0) ? (
        <EmptyState compact title="چیزی پیدا نشد" description="عبارت دیگری را امتحان کن." />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([group, items]) => (
            <div key={group || '_'} role="listbox" aria-label={group || (typeof title === 'string' ? title : undefined)}>
              {group && <p className="px-1 pb-1.5 text-micro text-fg-subtle">{group}</p>}
              <div className="flex flex-col gap-0.5">
                {items.map((o) => {
                  const selected = o.value === value;
                  return (
                    <button
                      key={`${group}-${o.value}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={o.disabled}
                      onClick={() => {
                        onValueChange(o.value);
                        onOpenChange(false);
                        setQuery('');
                      }}
                      className={cn(
                        'ds-focus flex min-h-13 w-full items-center gap-3 rounded-control px-3 py-2 text-start transition-colors',
                        'hover:bg-hover active:bg-pressed disabled:opacity-45',
                        selected && 'bg-accent-soft'
                      )}
                    >
                      {o.leading && <span className="shrink-0">{o.leading}</span>}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn('truncate text-callout', selected ? 'font-semibold text-accent-ink' : 'text-fg')}>{o.label}</span>
                        {o.description && <span className="truncate text-caption text-fg-subtle">{o.description}</span>}
                      </span>
                      {o.trailing && <span className="shrink-0 text-caption text-fg-subtle">{o.trailing}</span>}
                      {selected && <Check className="size-4.5 shrink-0 text-accent-ink" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export interface PickerFieldProps<T extends string = string> extends Omit<PickerSheetProps<T>, 'open' | 'onOpenChange' | 'title'> {
  /** Sheet title. */
  title: string;
  placeholder?: string;
  className?: string;
}

/** Form control that shows the chosen option and opens a `PickerSheet`. */
export function PickerField<T extends string>({ title, placeholder = 'انتخاب کنید', className, ...props }: PickerFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const field = useField();
  const selected = props.options.find((o) => o.value === props.value);
  return (
    <>
      <button
        type="button"
        id={field?.id}
        aria-haspopup="dialog"
        aria-describedby={field?.errorId ?? field?.descriptionId}
        onClick={() => setOpen(true)}
        className={cn(controlBox, 'ds-focus h-12 cursor-pointer text-start', field?.invalid && 'border-negative', className)}
      >
        {selected?.leading && <span className="shrink-0 [&>*]:size-7">{selected.leading}</span>}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-fg-disabled')}>{selected?.label ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-fg-subtle" aria-hidden />
      </button>
      <PickerSheet {...props} title={title} open={open} onOpenChange={setOpen} />
    </>
  );
}
