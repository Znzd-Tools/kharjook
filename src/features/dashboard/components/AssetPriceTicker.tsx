'use client';

import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';

export interface PriceTickerItem {
  id: string;
  label: string;
  price: string;
  href: string;
}

export interface AssetPriceTickerProps {
  items: PriceTickerItem[];
}

export function AssetPriceTicker({ items }: AssetPriceTickerProps) {
  const router = useRouter();

  if (items.length === 0) return null;

  const loop = [...items, ...items];
  const durationSec = Math.max(24, items.length * 5);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-surface-raised">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <TrendingUp size={14} className="text-cyan-400 shrink-0" />
        <p className="text-xs font-medium text-zinc-400">قیمت لحظه‌ای</p>
      </div>

      <div className="relative overflow-hidden py-2.5">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-linear-to-l from-surface-raised to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-linear-to-r from-surface-raised to-transparent"
          aria-hidden
        />

        <div
          className="price-ticker-viewport overflow-hidden"
          style={{ ['--ticker-duration' as string]: `${durationSec}s` }}
        >
          <div className="price-ticker-track flex w-max items-stretch gap-2 px-3">
            {loop.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                onClick={() => router.push(item.href)}
                className="price-ticker-item shrink-0 rounded-xl border border-white/8 bg-surface-inset/80 px-3 py-2 text-right transition-colors hover:border-cyan-500/30 hover:bg-surface-hover active:scale-[0.98]"
              >
                <p className="text-xs text-zinc-400 whitespace-nowrap">{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-white whitespace-nowrap" dir="ltr">
                  {item.price}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
