'use client';

import Link from 'next/link';
import { Money, Section } from '@/shared/components/ui';

export interface PriceStripItem {
  id: string;
  label: string;
  price: string;
  href: string;
}

/** Live unit prices of held assets, as a calm swipeable row (no auto-scroll). */
export function PriceStrip({ items }: { items: PriceStripItem[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="قیمت‌ها" action={{ label: 'همه', href: '/prices' }}>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 scrollbar-hide">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="min-w-32 shrink-0 snap-start rounded-2xl border border-white/5 bg-surface-raised px-3.5 py-3 hover:bg-surface-hover transition-colors"
          >
            <p className="truncate text-xs text-zinc-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">
              <Money>{item.price}</Money>
            </p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
