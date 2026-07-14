'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Repeat } from 'lucide-react';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import type { Subscription } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { daysBetweenJalaali } from '@/features/notifications/utils/jalali-days';
import { toPersianDigits } from '@/shared/utils/format-display-number';

function dueHint(daysUntil: number | null): string {
  if (daysUntil == null) return '';
  if (daysUntil < 0) return `${toPersianDigits(Math.abs(daysUntil))} روز گذشته`;
  if (daysUntil === 0) return 'امروز';
  if (daysUntil === 1) return 'فردا';
  return `${toPersianDigits(daysUntil)} روز دیگر`;
}

function dueTone(daysUntil: number | null): string {
  if (daysUntil == null) return 'text-slate-400';
  if (daysUntil < 0) return 'text-rose-400';
  if (daysUntil === 0) return 'text-amber-300';
  if (daysUntil <= 7) return 'text-amber-200/90';
  return 'text-slate-400';
}

export function PendingSubscriptionsWidget({ subscriptions }: { subscriptions: Subscription[] }) {
  const router = useRouter();
  const { currencyRates } = useData();
  const { currencyMode, usdRate } = useUI();
  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);

  const rows = useMemo(() => {
    return subscriptions
      .filter((row) => row.status === 'active')
      .sort((a, b) => a.next_due_date_string.localeCompare(b.next_due_date_string))
      .slice(0, 5)
      .map((row) => {
        const rate = tomanPerUnit(row.currency, currencyRates);
        const toman = row.amount * (rate > 0 ? rate : 0);
        const displayAmount =
          currencyMode === 'USD' && usdRate > 0 ? toman / usdRate : toman;
        const daysUntil = daysBetweenJalaali(todayStr, row.next_due_date_string);
        const due = parseJalaali(row.next_due_date_string);
        return {
          id: row.id,
          platform: row.platform,
          dueLabel: due ? formatJalaaliHuman(due) : row.next_due_date_string,
          dueHint: dueHint(daysUntil),
          dueTone: dueTone(daysUntil),
          amountLabel: formatCurrency(displayAmount, currencyMode),
          daysUntil,
        };
      });
  }, [currencyMode, currencyRates, subscriptions, todayStr, usdRate]);

  const activeCount = useMemo(
    () => subscriptions.filter((row) => row.status === 'active').length,
    [subscriptions]
  );

  if (activeCount === 0) return null;

  const overdueCount = rows.filter((row) => row.daysUntil != null && row.daysUntil < 0).length;

  return (
    <section className="bg-[#1A1B26] border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-300">
            <Repeat size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">اشتراک‌های نزدیک</h3>
            <p className="text-[11px] text-slate-500">
              {toPersianDigits(activeCount)} مورد
              {overdueCount > 0 ? ` · ${toPersianDigits(overdueCount)} معوق` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/deadlines/subscriptions')}
          className="text-[11px] text-purple-400 hover:text-purple-300 inline-flex items-center gap-0.5"
        >
          همه
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => router.push('/deadlines/subscriptions')}
            className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5 text-right hover:bg-white/[0.06] transition"
          >
            <div className="min-w-0">
              <p className="text-xs text-slate-200 font-medium truncate">{row.platform}</p>
              <p className="text-[10px] text-slate-500 truncate">{row.dueLabel}</p>
              {row.dueHint && (
                <p className={`text-[10px] mt-0.5 ${row.dueTone}`}>{row.dueHint}</p>
              )}
            </div>
            <span className="text-xs font-bold text-slate-300 shrink-0" dir="ltr">
              {row.amountLabel}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
