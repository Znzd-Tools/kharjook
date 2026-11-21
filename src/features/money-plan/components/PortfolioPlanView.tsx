'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Amount, AmountField, Avatar, Banner, Button, Delta, EmptyState, Field, List, ListRow, Section, Skeleton, Switch, Text } from '@/design-system';
import { Coins, Target } from '@/design-system/icons';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { effectivePriceAt } from '@/features/reports/utils/price-history';
import { avgMonthlyExpense } from '@/features/dashboard/utils/insights';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { addIntervalDate } from '@/features/deadlines/utils/schedule';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { useMoneyPlanData } from '../hooks/use-money-plan-data';
import { buildRebalance, buildScorecard, portfolioRisks, type HoldingRow } from '../utils/portfolio-plan';

const pctTone = (v: number | null) => (v == null ? '—' : <Delta value={v} />);

/** Real (USD) returns, what to buy with new money, and portfolio risks. */
export function PortfolioPlanView() {
  const { assets, transactions, dailyPrices, goals, categories } = useData();
  const { usdRate, currencyMode } = useUI();
  const histories = useRateHistories();
  const { debts, cashToman, isLoading } = useMoneyPlanData();
  const today = useMemo(() => todayJalaali(), []);
  const todayStr = formatJalaali(today);
  const [newCash, setNewCash] = useState('');
  const [allowSell, setAllowSell] = useState(false);
  const toMode = (toman: number) => (currencyMode === 'USD' && usdRate > 0 ? toman / usdRate : toman);

  /** Investment portfolio only (assets counted in the portfolio). */
  const rows: HoldingRow[] = useMemo(() => {
    const past = (months: number) => formatJalaali(addIntervalDate(today, -months, 'month'));
    const dates = { m3: past(3), m6: past(6), m12: past(12) };
    const usdAt = (date: string) => {
      const r = histories.USD.at(date);
      return r && r > 0 ? r : 0;
    };
    const priceUsdAt = (a: (typeof assets)[number], date: string) => {
      const p = effectivePriceAt(a, date, dailyPrices, todayStr, transactions);
      if (!p) return null;
      if (p.priceUsd > 0) return p.priceUsd;
      const r = usdAt(date);
      return r > 0 ? p.priceToman / r : null;
    };
    return assets
      .filter((a) => a.include_in_balance !== false)
      .map((a) => {
        const st = calculateAssetStats(a, transactions, 'TOMAN', usdRate);
        const nowUsd = Number(a.price_usd) > 0 ? Number(a.price_usd) : usdRate > 0 ? Number(a.price_toman) / usdRate : 0;
        return {
          asset: a,
          quantity: st.totalAmount,
          valueToman: st.currentValueToman,
          priceUsdNow: nowUsd,
          priceUsdAt: { m3: priceUsdAt(a, dates.m3), m6: priceUsdAt(a, dates.m6), m12: priceUsdAt(a, dates.m12) },
        };
      })
      .filter((r) => r.quantity > 0);
  }, [assets, transactions, dailyPrices, usdRate, histories, today, todayStr]);

  const score = useMemo(() => buildScorecard(rows), [rows]);
  const hasGoals = goals.some((g) => g.target_kind === 'allocation_percent');
  const plan = useMemo(
    () => buildRebalance({ rows, goals, categories, newCashToman: Number(newCash) || 0, allowSell }),
    [rows, goals, categories, newCash, allowSell]
  );

  const risks = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.valueToman, 0);
    const groups = new Map<string, number>();
    for (const r of rows) {
      const name = categories.find((c) => c.id === r.asset.category_id)?.name ?? 'بدون گروه';
      groups.set(name, (groups.get(name) ?? 0) + r.valueToman);
    }
    const usdLike = rows.filter((r) => r.priceUsdNow > 0.9 && r.priceUsdNow < 1.1).reduce((s, r) => s + r.valueToman, 0);
    return portfolioRisks({
      score,
      groupShares: [...groups].map(([name, v]) => ({ name, sharePct: total > 0 ? (v / total) * 100 : 0 })),
      cashToman,
      avgMonthlySpending: avgMonthlyExpense(transactions, today),
      fxDebtToman: debts.filter((d) => d.fx).reduce((s, d) => s + d.remainingToman, 0),
      usdLikeAssetsToman: usdLike,
      hasGoals,
    });
  }, [rows, score, categories, cashToman, transactions, today, debts, hasGoals]);

  if (isLoading) {
    return (
      <div className="space-y-3 px-(--ds-gutter) pt-1">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-(--ds-gutter) pt-1">
        <div className="rounded-card bg-panel">
          <EmptyState icon={<Coins />} title="دارایی‌ای در سبد نیست" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-6">
      {risks.length > 0 && (
        <Section title="هشدارها">
          <div className="space-y-2">
            {risks.map((r) => (
              <Banner key={r.key} tone={r.tone} title={r.title}>
                {r.text}
              </Banner>
            ))}
          </div>
        </Section>
      )}

      <Section title="بازده واقعی (دلاری)" description="تغییر قیمت به دلار. با تومان تقریباً همه‌چیز بالا می‌رود؛ دلار نشان می‌دهد واقعاً سود کرده یا نه.">
        <List>
          {score.map((s) => {
            const row = rows.find((r) => r.asset.id === s.assetId)!;
            return (
              <ListRow
                key={s.assetId}
                render={<Link href={`/assets/${s.assetId}`} />}
                chevron={false}
                leading={<Avatar size="sm" src={row.asset.icon_url} name={s.name} fallback={<Coins />} tone="lemon" />}
                title={
                  <span className="inline-flex items-center gap-2">
                    {s.name}
                    <span className="text-caption text-fg-subtle tabular">{Math.round(s.sharePct).toLocaleString('fa-IR')}٪ سبد</span>
                  </span>
                }
                subtitle={
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="inline-flex items-center gap-1">۳ ماه {pctTone(s.usd.m3)}</span>
                    <span className="inline-flex items-center gap-1">۶ ماه {pctTone(s.usd.m6)}</span>
                    <span className="inline-flex items-center gap-1">۱۲ ماه {pctTone(s.usd.m12)}</span>
                  </span>
                }
                trailing={<Amount value={toMode(s.valueToman)} currency={currencyMode} size="sm" compact />}
              />
            );
          })}
        </List>
      </Section>

      <Section
        title="برنامه‌ی خرید"
        description="با پول جدید چه بخری تا به اهدافت برسی."
        action={
          <Button variant="link" size="sm" render={<Link href="/manage/goals" />} nativeButton={false}>
            اهداف
          </Button>
        }
      >
        {plan.noGoals ? (
          <div className="rounded-card bg-panel">
            <EmptyState
              compact
              icon={<Target />}
              title="هنوز هدف درصدی نداری"
              description="برای دارایی‌ها یا گروه‌ها درصد هدف بگذار تا برنامه ساخته شود."
              action={
                <Button render={<Link href="/manage/goals" />} nativeButton={false}>
                  گذاشتن هدف
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-card bg-panel p-4">
            <Field label="پول جدید برای سرمایه‌گذاری">
              <AmountField aria-label="پول جدید برای سرمایه‌گذاری" value={newCash} onValueChange={setNewCash} />
            </Field>
            <Switch label="فروش هم مجاز است" description="دارایی‌های بالاتر از هدف را می‌فروشد تا دقیقاً به هدف برسی." checked={allowSell} onCheckedChange={setAllowSell} />
            {plan.targetSumPct > 100.5 && (
              <Text variant="caption" tone="warning">
                جمع درصد اهدافت {Math.round(plan.targetSumPct).toLocaleString('fa-IR')}٪ است (بیشتر از ۱۰۰٪)؛ اهداف را اصلاح کن.
              </Text>
            )}
            {plan.actions.length === 0 ? (
              <Text variant="caption" tone="subtle">
                {Number(newCash) > 0 || allowSell ? 'سبدت با اهدافت جور است؛ کاری لازم نیست.' : 'مبلغ پول جدید را وارد کن یا فروش را روشن کن.'}
              </Text>
            ) : (
              <List variant="plain">
                {plan.actions.map((a) => {
                  const d = a.asset ? assetDecimals(a.asset) : 0;
                  return (
                    <ListRow
                      key={`${a.kind}:${a.key}`}
                      size="sm"
                      chevron={false}
                      leading={<Avatar size="sm" tone={a.kind === 'buy' ? 'positive' : 'negative'} fallback={<Coins />} />}
                      title={`${a.kind === 'buy' ? 'بخر' : 'بفروش'}: ${a.label}${a.via ? ` (مثلاً ${a.via})` : ''}`}
                      subtitle={a.units != null && a.asset ? `حدود ${formatAssetAmount(a.units, d)} ${a.asset.unit}` : undefined}
                      trailing={<Amount value={toMode(a.toman)} currency={currencyMode} size="sm" compact tone={a.kind === 'buy' ? 'positive' : 'negative'} />}
                    />
                  );
                })}
              </List>
            )}
            {plan.leftoverToman > 1 && plan.actions.length > 0 && (
              <span className="flex items-center gap-1 text-caption text-fg-subtle">
                باقی می‌ماند (هدفی بیشتر نمی‌خواهد): <Amount value={toMode(plan.leftoverToman)} currency={currencyMode} size="xs" compact />
              </span>
            )}
          </div>
        )}
      </Section>
      <Text variant="caption" tone="subtle">
        فقط دارایی‌های داخل سبد سرمایه‌گذاری. قیمت‌های گذشته از قیمت‌های روزانه و معاملات خودت است؛ اگر نبود «—» نشان می‌دهد.
      </Text>
    </div>
  );
}
