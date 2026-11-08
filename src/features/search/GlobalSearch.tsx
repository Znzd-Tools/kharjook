'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState, SearchField, Sheet } from '@/design-system';
import { ChevronLeft } from '@/design-system/icons';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { GROUP_LABEL, search, type SearchResult } from './search-index';

/** Search everything + run actions + quick entry ("۸۵ کافه نقد"). */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { wallets, assets, persons, categories, transactions } = useData();
  const [q, setQ] = useState('');
  const results = useMemo(() => search(q, { wallets, assets, persons, categories, transactions }), [q, wallets, assets, persons, categories, transactions]);
  const groups = useMemo(() => {
    const map = new Map<SearchResult['group'], SearchResult[]>();
    for (const r of results) map.set(r.group, [...(map.get(r.group) ?? []), r]);
    return [...map.entries()];
  }, [results]);

  const go = (href: string) => {
    onOpenChange(false);
    setQ('');
    router.push(href);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setQ('');
        onOpenChange(o);
      }}
      size="full"
      title="جستجو"
      hideTitle
      header={<SearchField value={q} onValueChange={setQ} placeholder="جستجو یا «۸۵ هزار کافه نقد»" autoFocus aria-label="جستجو" />}
    >
      {!q.trim() ? (
        <p className="px-1 pt-2 text-caption text-fg-subtle">نام کیف پول، دارایی، شخص، دسته، یادداشت یا مبلغ را بنویس. یک کار هم می‌شود: «نرخ دلار»، «سود».</p>
      ) : results.length === 0 ? (
        <EmptyState compact title="چیزی پیدا نشد" />
      ) : (
        <div className="space-y-4">
          {groups.map(([group, items]) => (
            <div key={group} role="group" aria-label={GROUP_LABEL[group]}>
              <p className="px-1 pb-1.5 text-micro text-fg-subtle">{GROUP_LABEL[group]}</p>
              <ul className="overflow-hidden rounded-card bg-sunken">
                {items.map((r, i) => (
                  <li key={r.key} className={i > 0 ? 'border-t border-line' : undefined}>
                    <button
                      type="button"
                      onClick={() => go(r.href)}
                      className="ds-focus flex min-h-12 w-full items-center gap-3 px-4 py-2 text-start hover:bg-hover"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={r.group === 'entry' ? 'truncate text-callout font-semibold text-accent-ink' : 'truncate text-callout text-fg'}>{r.title}</span>
                        {r.subtitle && <span className="truncate text-caption text-fg-subtle">{r.subtitle}</span>}
                      </span>
                      <ChevronLeft className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
