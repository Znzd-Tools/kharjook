'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Amount, AmountField, Avatar, Badge, Banner, EmptyState, Field, List, ListRow, Section, Skeleton, Sparkline, Text } from '@/design-system';
import { FileText, Landmark, Receipt, Users } from '@/design-system/icons';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { useMoneyPlanData } from '../hooks/use-money-plan-data';
import { loanDebtTrend, simulatePayoff, summarizeDebts, type DebtItem, type DebtKind } from '../utils/debts';
import { addMonthPrefix, monthLabel } from '../utils/month-label';

const GROUPS: { kind: DebtKind; title: string; icon: React.ReactNode; href: (d: DebtItem) => string }[] = [
  { kind: 'loan', title: 'وام‌ها', icon: <Landmark />, href: () => '/deadlines/loans' },
  { kind: 'bnpl', title: 'خرید اعتباری (قسطی)', icon: <Receipt />, href: () => '/deadlines/loans' },
  { kind: 'check', title: 'چک‌های پرداختی', icon: <FileText />, href: () => '/deadlines/checks' },
  { kind: 'person', title: 'به اشخاص', icon: <Users />, href: (d) => `/deadlines/persons/${d.id}` },
];

const human = (d: string | null) => {
  const p = d ? parseJalaali(d) : null;
  return p ? formatJalaaliHuman(p) : '—';
};

/** Every debt in one place: total, monthly load, end dates, payoff with extra money. */
export function DebtsView() {
  const { assets, currencyRates } = useData();
  const { usdRate, currencyMode } = useUI();
  const { debts, loans, installments, isLoading } = useMoneyPlanData();
  const [extra, setExtra] = useState('');
  const today = useMemo(() => todayJalaali(), []);
  const thisMonth = formatJalaali(today).slice(0, 7);
  const summary = useMemo(() => summarizeDebts(debts), [debts]);
  const toMode = (toman: number) => (currencyMode === 'USD' && usdRate > 0 ? toman / usdRate : toman);

  const trend = useMemo(() => {
    const ends = [-5, -4, -3, -2, -1].map((n) => `${addMonthPrefix(thisMonth, n)}/31`);
    return loanDebtTrend({ loans, installments, assets, currencyRates, usdRate }, ends);
  }, [loans, installments, assets, currencyRates, usdRate, thisMonth]);
  const loanNow = debts.filter((d) => d.kind === 'loan' || d.kind === 'bnpl').reduce((s, d) => s + d.remainingToman, 0);

  const scheduled = debts.filter((d) => d.schedule.length > 0);
  const base = useMemo(() => simulatePayoff(scheduled, thisMonth, 0), [scheduled, thisMonth]);
  const extraNum = Number(extra) || 0;
  const withExtra = useMemo(() => (extraNum > 0 ? simulatePayoff(scheduled, thisMonth, extraNum) : null), [scheduled, thisMonth, extraNum]);

  if (isLoading) {
    return (
      <div className="space-y-3 px-(--ds-gutter) pt-1">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <div className="px-(--ds-gutter) pt-1">
        <div className="rounded-card bg-panel">
          <EmptyState icon={<Landmark />} title="بدهی‌ای نداری" description="وام، خرید قسطی، چک پرداختی یا بدهی به اشخاص اینجا جمع می‌شود." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-6">
      <section aria-label="جمع بدهی" className="space-y-3 rounded-card bg-panel p-5">
        <Text variant="caption" tone="subtle">
          جمع بدهی‌ها
        </Text>
        <Amount value={toMode(summary.totalToman)} currency={currencyMode} size="hero" />
        {currencyMode === 'TOMAN' && usdRate > 0 && (
          <span className="block text-caption text-fg-subtle">
            ≈ <Amount value={summary.totalToman / usdRate} currency="USD" size="xs" compact />
          </span>
        )}
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <Text variant="caption" tone="subtle">
              قسط {monthLabel(thisMonth)}
            </Text>
            <Amount value={toMode(summary.dueInMonth(thisMonth))} currency={currencyMode} size="sm" compact />
          </div>
          <div>
            <Text variant="caption" tone="subtle">
              قسط {monthLabel(addMonthPrefix(thisMonth, 1))}
            </Text>
            <Amount value={toMode(summary.dueInMonth(addMonthPrefix(thisMonth, 1)))} currency={currencyMode} size="sm" compact />
          </div>
        </div>
        {summary.debtFreeDate && (
          <Text variant="caption" tone="muted">
            اگر طبق برنامه پرداخت کنی، آخرین قسط: {human(summary.debtFreeDate)}
          </Text>
        )}
      </section>

      {summary.fxToman > 0 && (
        <Banner tone="warning" title="بدهی ارزی">
          <span className="inline-flex flex-wrap items-center gap-1">
            <Amount value={toMode(summary.fxToman)} currency={currencyMode} size="xs" compact /> از بدهی‌ات به دلار، تتر یا یک دارایی است. اگر قیمتش
            بالا برود، بدهی‌ات به تومان بزرگ‌تر می‌شود.
          </span>
        </Banner>
      )}

      {trend.some((t) => t.toman > 0) && (
        <Section title="روند بدهی وام‌ها" description="پایان هر ماه، با قیمت امروز">
          <div className="flex items-center justify-between gap-3 rounded-card bg-panel p-4">
            <Sparkline aria-label="روند بدهی وام‌ها در ۶ ماه" data={[...trend.map((t) => t.toman), loanNow]} width={180} height={40} tone="accent" />
            <Amount value={toMode(loanNow)} currency={currencyMode} size="sm" compact />
          </div>
        </Section>
      )}

      <Section title="زودتر تمام کن" description="هر ماه چقدر بیشتر از قسط‌ها می‌دهی؟ اول کوچک‌ترین بدهی تمام می‌شود.">
        <div className="space-y-3 rounded-card bg-panel p-4">
          <Field label="پرداخت اضافه هر ماه">
            <AmountField aria-label="پرداخت اضافه هر ماه" value={extra} onValueChange={setExtra} />
          </Field>
          {withExtra && (
            <Text variant="callout" weight="semibold">
              {withExtra.debtFreeMonths < base.debtFreeMonths
                ? `همه‌ی بدهی‌های برنامه‌دار ${(base.debtFreeMonths - withExtra.debtFreeMonths).toLocaleString('fa-IR')} ماه زودتر تمام می‌شود: ${monthLabel(addMonthPrefix(thisMonth, withExtra.debtFreeMonths - 1))}.`
                : 'زمان پایان همه‌ی بدهی‌ها تغییر نمی‌کند، ولی بدهی‌های کوچک زودتر تمام می‌شوند.'}
            </Text>
          )}
        </div>
      </Section>

      {GROUPS.map((g) => {
        const rows = debts.filter((d) => d.kind === g.kind);
        if (rows.length === 0) return null;
        const sum = rows.reduce((s, d) => s + d.remainingToman, 0);
        return (
          <Section key={g.kind} title={g.title} action={<Amount value={toMode(sum)} currency={currencyMode} size="xs" compact />}>
            <List>
              {rows.map((d) => {
                const nextMonthAmount = d.schedule.filter((p) => p.due.startsWith(thisMonth)).reduce((s, p) => s + p.toman, 0);
                const newEnd = withExtra?.months.get(d.key);
                const oldEnd = base.months.get(d.key);
                return (
                  <ListRow
                    key={d.key}
                    render={<Link href={g.href(d)} />}
                    leading={<Avatar size="sm" tone={d.fx ? 'peach' : 'sky'} fallback={g.icon} />}
                    title={
                      <span className="inline-flex items-center gap-1.5">
                        {d.title}
                        {d.fx && <Badge tone="warning">ارزی</Badge>}
                      </span>
                    }
                    subtitle={
                      d.endDate ? (
                        <span>
                          {nextMonthAmount > 0 ? 'این ماه ' : ''}
                          {nextMonthAmount > 0 && <Amount value={toMode(nextMonthAmount)} currency={currencyMode} size="xs" compact />}
                          {nextMonthAmount > 0 ? ' · ' : ''}
                          پایان {human(d.endDate)}
                          {newEnd && oldEnd && newEnd < oldEnd ? ` → ${monthLabel(addMonthPrefix(thisMonth, newEnd - 1))}` : ''}
                        </span>
                      ) : (
                        'بدون برنامه‌ی پرداخت'
                      )
                    }
                    trailing={<Amount value={toMode(d.remainingToman)} currency={currencyMode} size="sm" compact />}
                  />
                );
              })}
            </List>
          </Section>
        );
      })}
      <Text variant="caption" tone="subtle">
        بدهی‌های ارزی و دارایی با قیمت امروز به تومان حساب شده‌اند. چک ضمانت جزو بدهی نیست.
      </Text>
    </div>
  );
}
