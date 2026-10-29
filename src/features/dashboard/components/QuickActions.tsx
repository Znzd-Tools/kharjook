'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ShoppingBag } from 'lucide-react';
import { haptic } from '@/shared/utils/haptics';

const ACTIONS = [
  { type: 'EXPENSE', label: 'هزینه', icon: ArrowUpRight, color: '#fb7185' },
  { type: 'INCOME', label: 'درآمد', icon: ArrowDownLeft, color: '#34d399' },
  { type: 'TRANSFER', label: 'انتقال', icon: ArrowLeftRight, color: '#38bdf8' },
  { type: 'BUY', label: 'خرید دارایی', icon: ShoppingBag, color: '#a5a9fc' },
] as const;

/** One-tap entry points into the transaction form, pre-set to a type. */
export function QuickActions() {
  return (
    <nav aria-label="ثبت سریع" className="grid grid-cols-4 gap-2">
      {ACTIONS.map(({ type, label, icon: Icon, color }) => (
        <Link
          key={type}
          href={`/transactions/new?type=${type}`}
          onClick={() => haptic('selection')}
          className="flex flex-col items-center gap-2 rounded-2xl py-3 hover:bg-white/4 active:scale-95 transition"
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <Icon size={20} strokeWidth={2} />
          </span>
          <span className="text-xs font-medium text-zinc-300">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
