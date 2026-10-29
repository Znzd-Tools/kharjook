'use client';

import { useMemo } from 'react';
import { CalendarClock, ReceiptText, Repeat } from 'lucide-react';
import { IconBadge, ListGroup, ListRow, Money, Section } from '@/shared/components/ui';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { installmentRemainingAmount } from '@/features/deadlines/utils/installment-remaining';
import { daysBetweenJalaali } from '@/features/notifications/utils/jalali-days';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { formatCurrency } from '@/shared/utils/format-currency';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import type { Currency } from '@/shared/types/domain';

/** How far ahead "upcoming" looks. Overdue items always show. */
const HORIZON_DAYS = 30;

type UpcomingItem = {
  id: string;
  kind: 'installment' | 'check' | 'subscription';
  title: string;
  due: string;
  amount: number;
  currency: Currency;
  href: string;
};

const KIND_META = {
  installment: { label: 'قسط', icon: CalendarClock, color: '#fbbf24' },
  check: { label: 'چک', icon: ReceiptText, color: '#a78bfa' },
  subscription: { label: 'اشتراک', icon: Repeat, color: '#22d3ee' },
} as const;

function dueHint(days: number | null) {
  if (days == null) return { text: '', tone: 'text-zinc-500' };
  if (days < 0) return { text: `${toPersianDigits(-days)} روز گذشته`, tone: 'text-rose-400' };
  if (days === 0) return { text: 'امروز', tone: 'text-amber-300' };
  if (days === 1) return { text: 'فردا', tone: 'text-amber-300' };
  return { text: `${toPersianDigits(days)} روز دیگر`, tone: days <= 7 ? 'text-amber-200/80' : 'text-zinc-500' };
}

/**
 * Loans, checks and subscriptions merged into one date-ordered list, so the
 * question "what do I have to pay soon?" has a single answer.
 */
export function UpcomingList({
  maxRows = 5,
  showAction = true,
  title = 'پرداخت‌های پیش رو',
}: {
  maxRows?: number;
  showAction?: boolean;
  title?: string;
} = {}) {
  const { upcomingDeadlines, checks, activeSubscriptions, currencyRates } = useData();
  const { currencyMode, usdRate } = useUI();
  const today = useMemo(() => formatJalaali(todayJalaali()), []);

  const { rows, total, count } = useMemo(() => {
    const items: (UpcomingItem & { days: number | null })[] = ([
      ...upcomingDeadlines.map((item) => ({
        id: `i-${item.id}`,
        kind: 'installment' as const,
        title: item.loanTitle ?? 'قسط',
        due: item.due_date_string,
        amount: installmentRemainingAmount(item),
        currency: item.loanCurrency ?? 'IRT',
        href: '/deadlines/loans',
      })),
      ...checks
        .filter((c) => c.status === 'pending')
        .map((c) => ({
          id: `c-${c.id}`,
          kind: 'check' as const,
          title: c.title,
          due: c.due_date_string,
          amount: c.amount,
          currency: c.currency,
          href: '/deadlines/checks',
        })),
      ...activeSubscriptions.map((s) => ({
        id: `s-${s.id}`,
        kind: 'subscription' as const,
        title: s.platform,
        due: s.next_due_date_string,
        amount: s.amount,
        currency: s.currency,
        href: '/deadlines/subscriptions',
      })),
    ] as UpcomingItem[])
      .map((item) => ({ ...item, days: daysBetweenJalaali(today, item.due) }))
      .filter((item) => item.days == null || item.days <= HORIZON_DAYS)
      .sort((a, b) => a.due.localeCompare(b.due));

    const toDisplay = (amount: number, currency: Currency) => {
      const rate = tomanPerUnit(currency, currencyRates);
      const toman = amount * (rate > 0 ? rate : 0);
      return currencyMode === 'USD' && usdRate > 0 ? toman / usdRate : toman;
    };
    const total = items.reduce((sum, item) => sum + toDisplay(item.amount, item.currency), 0);
    return {
      count: items.length,
      total,
      rows: items.slice(0, maxRows).map((item) => ({ ...item, display: toDisplay(item.amount, item.currency) })),
    };
  }, [upcomingDeadlines, checks, activeSubscriptions, currencyRates, currencyMode, usdRate, today, maxRows]);

  if (count === 0) return null;

  return (
    <Section
      title={title}
      description={
        <>
          {toPersianDigits(count)} مورد تا ۳۰ روز آینده ·{' '}
          <Money>{formatCurrency(total, currencyMode)}</Money>
        </>
      }
      action={showAction ? { label: 'سررسیدها', href: '/deadlines' } : undefined}
    >
      <ListGroup>
        {rows.map((row) => {
          const meta = KIND_META[row.kind];
          const Icon = meta.icon;
          const hint = dueHint(row.days);
          const parsed = parseJalaali(row.due);
          return (
            <ListRow
              key={row.id}
              href={row.href}
              leading={
                <IconBadge color={meta.color}>
                  <Icon size={18} strokeWidth={1.9} />
                </IconBadge>
              }
              title={row.title}
              subtitle={`${meta.label} · ${parsed ? formatJalaaliHuman(parsed) : row.due}`}
              trailing={<Money>{formatCurrency(row.display, currencyMode)}</Money>}
              trailingSub={<span className={hint.tone}>{hint.text}</span>}
            />
          );
        })}
      </ListGroup>
    </Section>
  );
}
