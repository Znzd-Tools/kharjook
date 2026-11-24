'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Amount, Avatar, BarChart, Button, ChipGroup, Chip, DivergingBars, SegmentedControl, Section, Text, formatMoney } from '@/design-system';
import { Coins } from '@/design-system/icons';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { ytdCumulativeProfitMonthlySeries } from '@/features/dashboard/utils/portfolio-history';
import { assetValueFor, buildPnlSummary, VIEW_LABEL, type PnlView } from '../utils/pnl-summary';
import { PnlCard } from './PnlCard';
import { NetWorthTrend, useSnapshots } from '@/features/portfolio-history/components/NetWorthTrend';

/** PnL screen (P2): views, per-asset contribution, monthly chart. */
export function PnlScreen() {
  const params = useSearchParams();
  const initial = (['active', 'year', 'allTime'] as const).find((v) => v === params.get('view')) ?? 'active';
  const [listView, setListView] = useState<PnlView>(initial);
  const [unit, setUnit] = useState<'toman' | 'usd'>('toman');
  const { assets, transactions, dailyPrices } = useData();
  const { usdRate } = useUI();
  const snapshots = useSnapshots();
  const today = useMemo(() => todayJalaali(), []);
  const todayStr = formatJalaali(today);

  const summary = useMemo(
    () => buildPnlSummary(assets, transactions, dailyPrices, usdRate, todayStr),
    [assets, transactions, dailyPrices, usdRate, todayStr]
  );

  const monthly = useMemo(() => {
    const series = ytdCumulativeProfitMonthlySeries(assets, transactions, dailyPrices, usdRate, today, todayStr);
    return series.map((p, i) => ({
      key: p.key,
      label: p.label,
      value: p.profitToman - (i > 0 ? series[i - 1]!.profitToman : 0),
    }));
  }, [assets, transactions, dailyPrices, usdRate, today, todayStr]);

  const rows = summary.rows
    .map((r) => ({ ...r, value: assetValueFor(r.pnl, listView) }))
    .filter((r) => r.pnl.included && Math.abs(r.value.toman) > 0.5)
    .sort((a, b) => (unit === 'usd' ? b.value.usd - a.value.usd : b.value.toman - a.value.toman));

  return (
    <div className="space-y-6 px-(--ds-gutter) pt-1 pb-8">
      <PnlCard summary={summary} initialView={initial} />

      <NetWorthTrend rows={snapshots} />

      {monthly.length > 1 && (
        <Section title="سود و زیان ماه‌به‌ماه امسال">
          <div className="rounded-card bg-panel p-4">
            <BarChart
              mode="signed"
              aria-label="سود و زیان هر ماه امسال"
              data={monthly}
              formatValue={(v) => formatMoney(v, { compact: true, signed: true }).text}
            />
          </div>
        </Section>
      )}

      <Section title="سهم هر دارایی">
        <ChipGroup aria-label="بازه فهرست" value={[listView]} onValueChange={(v) => v[0] && setListView(v[0] as PnlView)}>
          {(['active', 'year', 'allTime'] as PnlView[]).map((v) => (
            <Chip key={v} value={v}>
              {VIEW_LABEL[v]}
            </Chip>
          ))}
        </ChipGroup>
        <SegmentedControl
          aria-label="واحد"
          size="sm"
          value={unit}
          onValueChange={setUnit}
          options={[
            { value: 'toman', label: 'تومان' },
            { value: 'usd', label: 'دلار' },
          ]}
        />
        {rows.length === 0 ? (
          <Text variant="caption" tone="subtle" className="block rounded-card bg-panel p-4">
            در این بازه سود یا زیانی نیست.
          </Text>
        ) : (
          <DivergingBars
            aria-label="سود و زیان هر دارایی"
            rows={rows.map(({ asset, pnl, value }) => {
              const v = unit === 'usd' ? value.usd : value.toman;
              const pct = listView === 'active' && pnl.active.cost.toman > 0 ? (value.toman / pnl.active.cost.toman) * 100 : null;
              return {
                key: asset.id,
                value: v,
                render: <Link href={`/assets/${asset.id}`} />,
                leading: <Avatar size="sm" src={asset.icon_url} fallback={<Coins />} tone="lemon" />,
                label: asset.name,
                valueLabel: (
                  <span className="inline-flex items-baseline gap-1.5">
                    <Amount value={v} currency={unit === 'usd' ? 'USD' : 'TOMAN'} size="xs" compact tone="auto" signed />
                    {pct != null && (
                      <span className="text-micro text-fg-subtle tabular" dir="ltr">
                        {`${pct >= 0 ? '+' : '−'}${Math.abs(pct).toLocaleString('fa-IR', { maximumFractionDigits: 0 })}٪`}
                      </span>
                    )}
                  </span>
                ),
              };
            })}
          />
        )}
      </Section>

      <Button variant="secondary" fullWidth render={<Link href="/reports/assets?period=year" />} nativeButton={false}>
        سال‌های قبل و گزارش کامل دارایی‌ها
      </Button>
    </div>
  );
}
