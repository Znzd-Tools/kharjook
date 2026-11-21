'use client';

import { useMemo, useState } from 'react';
import { Amount, AmountField, Avatar, Badge, Banner, BarChart, Field, List, ListRow, Section, Skeleton, Text, toPersianDigits } from '@/design-system';
import { ArrowDownLeft, ArrowUpLeft, Coins } from '@/design-system/icons';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { assetHolding } from '@/features/transactions/utils/convert-transaction';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { addDays, formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { canonicalNumber } from '@/features/transactions/utils/transaction-form-logic';
import { useMoneyPlanData } from '../hooks/use-money-plan-data';
import { buildForecast, detectIncome, moneyRate, normalMonthlySpending, subscriptionDates, type ScheduledOutflow } from '../utils/forecast';
import { monthLabel } from '../utils/month-label';

const HORIZON = 90;
const human = (d: string) => {
  const p = parseJalaali(d);
  return p ? formatJalaaliHuman(p) : d;
};

/** Next 90 days of cash: income, normal spending and every scheduled payment. */
export function ForecastView() {
  const { transactions, categories, wallets, currencyRates, checks, activeSubscriptions, assets } = useData();
  const { usdRate, currencyMode } = useUI();
  const { loans, installments, scheduledPaymentTxIds, cashToman, isLoading } = useMoneyPlanData();
  const today = useMemo(() => todayJalaali(), []);
  const todayStr = formatJalaali(today);
  const endStr = formatJalaali(addDays(today, HORIZON - 1));
  const toMode = (toman: number) => (currencyMode === 'USD' && usdRate > 0 ? toman / usdRate : toman);

  const income = useMemo(
    () =>
      detectIncome(
        transactions,
        today,
        (id) => (id ? (categories.find((c) => c.id === id)?.name ?? 'درآمد') : 'درآمد بدون دسته'),
        wallets,
        currencyRates,
        usdRate
      ),
    [transactions, today, categories, wallets, currencyRates, usdRate]
  );
  const detectedSpending = useMemo(
    () => normalMonthlySpending(transactions, today, scheduledPaymentTxIds, wallets, currencyRates, usdRate),
    [transactions, today, scheduledPaymentTxIds, wallets, currencyRates, usdRate]
  );
  const [spendingInput, setSpendingInput] = useState<string | null>(null);
  const monthlySpending = spendingInput === null ? detectedSpending : Number(spendingInput) || 0;

  /** Money payments go on the cash line; asset payments (USDT …) are listed apart. */
  const { scheduled, assetNeeds } = useMemo(() => {
    const out: ScheduledOutflow[] = [];
    const needs = new Map<string, { qty: number; firstDue: string }>();
    for (const c of checks) {
      if (c.status !== 'pending' || c.deleted_at || c.is_guarantee || c.due_date_string > endStr) continue;
      out.push({ due: c.due_date_string, label: `چک ${c.title}`, toman: Number(c.amount) * moneyRate(c.currency, currencyRates, usdRate) });
    }
    const loansById = new Map(loans.map((l) => [l.id, l]));
    for (const i of installments) {
      if (i.is_paid || i.due_date_string > endStr) continue;
      const loan = loansById.get(i.loan_id);
      if (!loan) continue;
      const left = Math.max(0, Number(i.amount) - Number(i.paid_amount ?? 0));
      if (loan.asset_id) {
        const n = needs.get(loan.asset_id) ?? { qty: 0, firstDue: i.due_date_string };
        n.qty += left;
        if (i.due_date_string < n.firstDue) n.firstDue = i.due_date_string;
        needs.set(loan.asset_id, n);
        continue;
      }
      out.push({ due: i.due_date_string, label: `قسط ${loan.title}`, toman: left * moneyRate(loan.currency, currencyRates, usdRate) });
    }
    for (const s of activeSubscriptions) {
      for (const due of subscriptionDates(s, todayStr, endStr)) {
        out.push({ due, label: `اشتراک ${s.platform}`, toman: Number(s.amount) * moneyRate(s.currency, currencyRates, usdRate) });
      }
    }
    return { scheduled: out, assetNeeds: needs };
  }, [checks, installments, loans, activeSubscriptions, currencyRates, usdRate, todayStr, endStr]);

  const forecast = useMemo(
    () => buildForecast({ today, horizonDays: HORIZON, startCash: cashToman, income, monthlySpending, scheduled }),
    [today, cashToman, income, monthlySpending, scheduled]
  );

  if (isLoading) {
    return (
      <div className="space-y-3 px-(--ds-gutter) pt-1">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  const short = forecast.lowest.balance < 0;
  const weeks = forecast.days.filter((_, i) => i % 7 === 6 || i === forecast.days.length - 1);

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-6">
      <section aria-label="کمترین موجودی" className="space-y-2 rounded-card bg-panel p-5">
        <Text variant="caption" tone="subtle">
          کمترین موجودی در ۹۰ روز آینده
        </Text>
        <Amount value={toMode(forecast.lowest.balance)} currency={currencyMode} size="hero" tone={short ? 'negative' : 'default'} />
        <Text variant="callout" tone="muted">
          {human(forecast.lowest.date)}
        </Text>
        <span className="block text-caption text-fg-subtle">
          امروز: <Amount value={toMode(cashToman)} currency={currencyMode} size="xs" compact /> در همه‌ی کیف پول‌ها
        </span>
      </section>

      {forecast.firstNegative ? (
        <Banner tone="negative" title={`کمبود پول از ${human(forecast.firstNegative)}`}>
          با این روند، موجودی‌ات از این روز منفی می‌شود. یکی از پرداخت‌ها را جابه‌جا کن، خرجت را کم کن یا از قبل پول جور کن.
        </Banner>
      ) : (
        <Banner tone="positive">در ۹۰ روز آینده موجودی‌ات منفی نمی‌شود.</Banner>
      )}

      <Section title="موجودی پایان هر هفته" description="هفته‌ی ۱ تا ۱۳ از امروز.">
        <div className="rounded-card bg-panel p-4">
          <BarChart
            aria-label="موجودی پیش‌بینی‌شده پایان هر هفته"
            mode="signed"
            data={weeks.map((d, i) => ({ key: d.date, label: toPersianDigits(String(i + 1)), value: Math.round(toMode(d.balance)) }))}
            formatValue={(v) => `${Math.round(v / (currencyMode === 'USD' ? 1 : 1_000_000)).toLocaleString('fa-IR')}${currencyMode === 'USD' ? '$' : ' م'}`}
          />
        </div>
      </Section>

      <Section title="ماه به ماه">
        <List>
          {forecast.months.map((m) => (
            <ListRow
              key={m.month}
              chevron={false}
              title={monthLabel(m.month)}
              subtitle={
                <span className="inline-flex flex-wrap items-center gap-1">
                  ورودی <Amount value={toMode(m.income)} currency={currencyMode} size="xs" compact /> · خروجی{' '}
                  <Amount value={toMode(m.outflow)} currency={currencyMode} size="xs" compact />
                </span>
              }
              trailing={<Amount value={toMode(m.end)} currency={currencyMode} size="sm" compact tone={m.end < 0 ? 'negative' : 'default'} />}
              trailingSubtitle="پایان ماه"
            />
          ))}
        </List>
      </Section>

      <Section title="فرض‌ها" description="از ۳ ماه کامل گذشته حساب شده؛ خرج ماهانه را می‌توانی عوض کنی.">
        <div className="space-y-3 rounded-card bg-panel p-4">
          <Field label="خرج معمول ماهانه (بدون قسط، چک و اشتراک)">
            <AmountField
              aria-label="خرج معمول ماهانه"
              value={spendingInput ?? canonicalNumber(Math.round(detectedSpending))}
              onValueChange={setSpendingInput}
            />
          </Field>
          {income.length === 0 ? (
            <Text variant="caption" tone="warning">
              درآمد منظمی پیدا نشد (درآمدی که در دست‌کم ۲ ماه از ۳ ماه گذشته آمده باشد).
            </Text>
          ) : (
            <List variant="plain">
              {income.map((p) => (
                <ListRow
                  key={p.categoryId ?? 'none'}
                  size="sm"
                  chevron={false}
                  leading={<Avatar size="sm" tone="positive" fallback={<ArrowDownLeft />} />}
                  title={p.label}
                  subtitle={`هر ماه حدود روز ${p.day.toLocaleString('fa-IR')}`}
                  trailing={<Amount value={toMode(p.monthlyToman)} currency={currencyMode} size="sm" compact />}
                />
              ))}
            </List>
          )}
        </div>
      </Section>

      {assetNeeds.size > 0 && (
        <Section title="بدهی‌هایی که با دارایی پرداخت می‌شوند" description="این‌ها از نقد کم نمی‌شوند؛ باید آن دارایی را داشته باشی.">
          <List>
            {[...assetNeeds].map(([assetId, n]) => {
              const a = assets.find((x) => x.id === assetId);
              if (!a) return null;
              const have = assetHolding(assetId, transactions);
              const d = assetDecimals(a);
              const enough = have + 1e-9 >= n.qty;
              return (
                <ListRow
                  key={assetId}
                  chevron={false}
                  leading={<Avatar size="sm" src={a.icon_url} name={a.name} fallback={<Coins />} tone="lemon" />}
                  title={`${formatAssetAmount(n.qty, d)} ${a.unit} ${a.name} تا ${human(endStr)}`}
                  subtitle={`داری: ${formatAssetAmount(have, d)} ${a.unit} · اولین: ${human(n.firstDue)}`}
                  trailing={<Badge tone={enough ? 'positive' : 'negative'}>{enough ? 'کافی است' : `کم: ${formatAssetAmount(n.qty - have, d)}`}</Badge>}
                />
              );
            })}
          </List>
        </Section>
      )}

      <Section title="پرداخت‌ها و ورودی‌های پیش رو">
        <List>
          {forecast.events.slice(0, 40).map((e, i) => (
            <ListRow
              key={`${e.date}-${i}`}
              chevron={false}
              leading={<Avatar size="sm" tone={e.kind === 'income' ? 'positive' : 'negative'} fallback={e.kind === 'income' ? <ArrowDownLeft /> : <ArrowUpLeft />} />}
              title={e.label}
              subtitle={human(e.date)}
              trailing={<Amount value={toMode(e.kind === 'income' ? e.toman : -e.toman)} currency={currencyMode} size="sm" compact signed tone="auto" />}
            />
          ))}
        </List>
      </Section>
      <Text variant="caption" tone="subtle">
        پیش‌بینی است، نه قطعی: خرج معمول یکنواخت پخش شده و بدهی بدون تاریخ به اشخاص در آن نیست.
      </Text>
    </div>
  );
}
