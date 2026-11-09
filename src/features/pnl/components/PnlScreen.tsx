'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Amount, Avatar, BarChart, Button, ChipGroup, Chip, Delta, List, ListRow, Section, formatMoney } from '@/design-system';
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
    .sort((a, b) => Math.abs(b.value.toman) - Math.abs(a.value.toman));

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
        <List>
          {rows.map(({ asset, pnl, value }) => (
            <ListRow
              key={asset.id}
              render={<Link href={`/assets/${asset.id}`} />}
              leading={<Avatar src={asset.icon_url} fallback={<Coins />} tone="lemon" />}
              title={asset.name}
              subtitle={listView === 'active' && pnl.active.since ? `از ${pnl.active.since}` : undefined}
              trailing={<Amount value={value.toman} size="sm" compact tone="auto" signed />}
              trailingSubtitle={
                listView === 'active' && pnl.active.cost.toman > 0 ? <Delta value={(value.toman / pnl.active.cost.toman) * 100} /> : undefined
              }
            />
          ))}
        </List>
      </Section>

      <Button variant="secondary" fullWidth render={<Link href="/reports/assets?period=year" />} nativeButton={false}>
        سال‌های قبل و گزارش کامل دارایی‌ها
      </Button>
    </div>
  );
}
