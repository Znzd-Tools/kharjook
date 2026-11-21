'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Amount, Avatar, Banner, Chip, ChipGroup, Disclosure, EmptyState, Text, cn } from '@/design-system';
import { ArrowDownLeft, ArrowUpLeft, Coins } from '@/design-system/icons';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import type { CurrencyMode } from '@/shared/types/domain';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import {
  clampPeriodToToday,
  decodePeriodParams,
  encodePeriodParams,
  formatPeriodLabel,
  isCurrentPeriod,
  type Period,
} from '@/shared/utils/period';
import {
  formatJalaali,
  formatJalaaliHuman,
  parseJalaali,
  todayJalaali,
} from '@/shared/utils/jalali';
import { PeriodNavHeader } from '@/features/reports/components/PeriodNavHeader';
import { ReportExportButton } from '@/features/reports/components/ReportExportButton';
import {
  assetsCsvFilename,
  buildAssetsCsv,
} from '@/features/reports/utils/export-assets-csv';
import { downloadCsv } from '@/shared/utils/download-csv';
import {
  calculateAssetPeriodStats,
  type AssetPeriodStats,
} from '@/features/reports/utils/asset-period-stats';
import { effectivePriceAt, effectiveOpeningPriceAt } from '@/features/reports/utils/price-history';
import type { Asset } from '@/shared/types/domain';
import {
  filterAssetsForList,
  type ZeroValueFilter,
} from '@/features/assets/utils/asset-list-filters';

export function AssetsReportView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { assets, transactions, dailyPrices } = useData();
  const { usdRate, currencyMode } = useUI();

  const period = useMemo(
    () => clampPeriodToToday(decodePeriodParams(searchParams.get('period'), searchParams.get('d'))),
    [searchParams]
  );
  const assetFilter = searchParams.get('asset') || null;
  const zeroValueFilter: ZeroValueFilter =
    searchParams.get('zeros') === 'show' ? 'show' : 'hide';
  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);

  const pushParams = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`/reports/assets?${sp.toString()}`, { scroll: false });
  };
  const setPeriod = (p: Period) => {
    const { period, d } = encodePeriodParams(p);
    pushParams({ period, d });
  };
  const setAsset = (id: string | null) => pushParams({ asset: id });
  const setZeroValueFilter = (filter: ZeroValueFilter) =>
    pushParams({ zeros: filter === 'show' ? 'show' : null });

  const listAssets = useMemo(() => {
    const filtered = filterAssetsForList(
      assets,
      transactions,
      currencyMode,
      usdRate,
      zeroValueFilter
    );
    if (
      assetFilter &&
      !filtered.some((asset) => asset.id === assetFilter)
    ) {
      const selected = assets.find((asset) => asset.id === assetFilter);
      if (selected) return [...filtered, selected];
    }
    return filtered;
  }, [assets, transactions, currencyMode, usdRate, zeroValueFilter, assetFilter]);

  // Compute per-asset stats once. Price lookup is O(n) in dailyPrices per
  // asset; with hundreds of snapshots × tens of assets still well under a
  // frame. Memoization keeps it off the render hot path.
  const allStats = useMemo(() => {
    const periodEndStr = formatJalaali(period.end);
    return assets
      .filter((a) => a.include_in_profit_loss !== false)
      .filter((a) => listAssets.some((visible) => visible.id === a.id))
      .map((a) => {
        const startPrice =
          period.kind === 'all'
            ? null
            : effectiveOpeningPriceAt(a, period.start, dailyPrices, todayStr, transactions);
        const endPrice = effectivePriceAt(a, periodEndStr, dailyPrices, todayStr, transactions);
        return {
          asset: a,
          stats: calculateAssetPeriodStats(
            a,
            transactions,
            period,
            usdRate,
            endPrice,
            startPrice
          ),
        };
      });
  }, [assets, transactions, period, usdRate, dailyPrices, todayStr, listAssets]);

  const visible = assetFilter
    ? allStats.filter((x) => x.asset.id === assetFilter)
    : allStats;

  // Sort: period activity first (by abs realized desc), then zero-activity
  // by period-end notional value desc (endHoldings × endAvgCost).
  const sorted = useMemo(() => {
    return [...visible].sort((a, b) => {
      const aAct = a.stats.hadActivity ? 1 : 0;
      const bAct = b.stats.hadActivity ? 1 : 0;
      if (aAct !== bAct) return bAct - aAct;
      if (a.stats.hadActivity) {
        return (
          Math.abs(b.stats.realizedToman) - Math.abs(a.stats.realizedToman)
        );
      }
      const aVal =
        a.stats.endHoldings *
        (a.stats.periodEndPriceToman ?? a.asset.price_toman ?? 0);
      const bVal =
        b.stats.endHoldings *
        (b.stats.periodEndPriceToman ?? b.asset.price_toman ?? 0);
      return bVal - aVal;
    });
  }, [visible]);

  // Totals across currently visible assets. Only aggregate unrealized for
  // assets where we actually know the period-end price — zeros from missing
  // data would LIE. We expose `unrealizedMissingCount` so the UI can flag
  // that the total is partial.
  const totals = useMemo(() => {
    let realizedToman = 0;
    let realizedUsd = 0;
    let unrealizedToman = 0;
    let unrealizedUsd = 0;
    let unrealizedMissingCount = 0;
    let invalidTradeCount = 0;
    let oversellCount = 0;
    let buyCount = 0;
    let sellCount = 0;
    for (const { stats } of visible) {
      realizedToman += stats.realizedToman;
      realizedUsd += stats.realizedUsd;
      if (stats.periodUnrealizedAvailable) {
        unrealizedToman += stats.periodUnrealizedToman;
        unrealizedUsd += stats.periodUnrealizedUsd;
      } else if (stats.currentHoldings > 0 || stats.endHoldings > 0) {
        unrealizedMissingCount += 1;
      }
      invalidTradeCount += stats.invalidTradeCount;
      oversellCount += stats.oversellCount;
      buyCount += stats.bought.count;
      sellCount += stats.sold.count;
    }
    return {
      realizedToman,
      realizedUsd,
      unrealizedToman,
      unrealizedUsd,
      unrealizedMissingCount,
      invalidTradeCount,
      oversellCount,
      buyCount,
      sellCount,
    };
  }, [visible]);

  const periodIsCurrent = isCurrentPeriod(period);
  const periodEndLabel = periodIsCurrent
    ? 'تا اکنون'
    : `پایان ${formatPeriodLabel(period)}`;

  const exportCsv = () => {
    downloadCsv(
      assetsCsvFilename(period),
      buildAssetsCsv({
        period,
        currencyMode,
        rows: sorted,
        totals,
      })
    );
  };

  return (
    <div className="space-y-4 px-(--ds-gutter) pt-1 pb-6">
      <div className="flex items-center justify-between gap-2">
        <Text variant="title" weight="semibold">
          سود و زیان دارایی‌ها
        </Text>
        <ReportExportButton onClick={exportCsv} disabled={sorted.length === 0} />
      </div>

      <PeriodNavHeader period={period} onChange={setPeriod} />

      {listAssets.length > 0 && (
        <ChipGroup aria-label="دارایی" value={[assetFilter ?? '__all']} onValueChange={(v) => v[0] && setAsset(v[0] === '__all' ? null : v[0])}>
          <Chip value="__all">همه دارایی‌ها</Chip>
          {listAssets.map((a) => (
            <Chip key={a.id} value={a.id}>
              {a.name}
            </Chip>
          ))}
        </ChipGroup>
      )}
      <ChipGroup aria-label="دارایی‌های صفر" value={[zeroValueFilter]} onValueChange={(v) => v[0] && setZeroValueFilter(v[0] as ZeroValueFilter)}>
        <Chip value="hide">بدون صفر</Chip>
        <Chip value="show">شامل صفر</Chip>
      </ChipGroup>

      <SummaryCard
        total={currencyMode === 'USD' ? totals.realizedUsd + totals.unrealizedUsd : totals.realizedToman + totals.unrealizedToman}
        realized={currencyMode === 'USD' ? totals.realizedUsd : totals.realizedToman}
        unrealized={currencyMode === 'USD' ? totals.unrealizedUsd : totals.unrealizedToman}
        unrealizedMissingCount={totals.unrealizedMissingCount}
        buyCount={totals.buyCount}
        sellCount={totals.sellCount}
        periodEndLabel={periodEndLabel}
        currencyMode={currencyMode}
      />

      {sorted.length === 0 ? (
        <div className="rounded-card bg-panel">
          <EmptyState icon={<Coins />} title="دارایی‌ای برای نمایش نیست" />
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ asset, stats }) => (
            <AssetRow key={asset.id} asset={asset} stats={stats} currencyMode={currencyMode} />
          ))}
        </div>
      )}

      {totals.unrealizedMissingCount > 0 && (
        <Text variant="caption" tone="subtle">
          برای {totals.unrealizedMissingCount.toLocaleString('fa-IR')} دارایی قیمت پایان دوره نیست؛ سود و زیان باز آن‌ها در جمع نیامده. با
          ثبت قیمت روزانه یا تراکنش در آن روز، تاریخچه ساخته می‌شود.
        </Text>
      )}
      {(totals.invalidTradeCount > 0 || totals.oversellCount > 0) && (
        <Banner tone="negative">
          {totals.invalidTradeCount > 0 && `${totals.invalidTradeCount.toLocaleString('fa-IR')} رکورد دارایی نامعتبر از محاسبه حذف شد.`}
          {totals.invalidTradeCount > 0 && totals.oversellCount > 0 && ' '}
          {totals.oversellCount > 0 && `${totals.oversellCount.toLocaleString('fa-IR')} فروش بیشتر از موجودی پیدا شد.`}
        </Banner>
      )}
    </div>
  );
}

function SummaryCard({
  total,
  realized,
  unrealized,
  unrealizedMissingCount,
  buyCount,
  sellCount,
  periodEndLabel,
  currencyMode,
}: {
  total: number;
  realized: number;
  unrealized: number;
  unrealizedMissingCount: number;
  buyCount: number;
  sellCount: number;
  periodEndLabel: string;
  currencyMode: CurrencyMode;
}) {
  return (
    <section aria-label="سود و زیان کل دوره" className="space-y-3 rounded-card bg-panel p-4">
      <Text variant="caption" tone="subtle">
        سود و زیان کل دوره
      </Text>
      <Amount value={total} currency={currencyMode} size="hero" signed tone="auto" />
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <Fact label="محقق‌شده" hint="از فروش‌های همین دوره">
          <Amount value={realized} currency={currencyMode} size="sm" signed tone="auto" compact />
        </Fact>
        <Fact label={`باز · ${periodEndLabel}`} hint={unrealizedMissingCount > 0 ? `${unrealizedMissingCount.toLocaleString('fa-IR')} دارایی بدون قیمت` : 'با قیمت پایان دوره'} warn={unrealizedMissingCount > 0}>
          <Amount value={unrealized} currency={currencyMode} size="sm" signed tone="auto" compact />
        </Fact>
      </div>
      <Text variant="caption" tone="subtle">
        {buyCount.toLocaleString('fa-IR')} خرید · {sellCount.toLocaleString('fa-IR')} فروش
      </Text>
    </section>
  );
}

function Fact({ label, hint, warn, children }: { label: string; hint?: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
      <div>{children}</div>
      {hint && (
        <Text variant="micro" tone={warn ? 'warning' : 'subtle'}>
          {hint}
        </Text>
      )}
    </div>
  );
}

function AssetRow({ asset, stats, currencyMode }: { asset: Asset; stats: AssetPeriodStats; currencyMode: CurrencyMode }) {
  const hasActivity = stats.hadActivity;
  const realized = currencyMode === 'USD' ? stats.realizedUsd : stats.realizedToman;
  const unrealized = currencyMode === 'USD' ? stats.periodUnrealizedUsd : stats.periodUnrealizedToman;
  const total = stats.periodUnrealizedAvailable ? realized + unrealized : hasActivity ? realized : null;
  const decimals = assetDecimals(asset);
  const staleDate =
    stats.periodUnrealizedAvailable && stats.periodEndPriceSourceDate && !stats.periodEndPriceIsLive
      ? parseJalaali(stats.periodEndPriceSourceDate)
      : null;

  return (
    <div className="rounded-card bg-panel px-4">
      <Disclosure
        title={
          <span className="flex min-w-0 items-center gap-3">
            <Avatar size="sm" src={asset.icon_url} name={asset.name} fallback={<Coins />} tone="lemon" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-callout font-semibold text-fg">{asset.name}</span>
              <span className="block text-caption text-fg-subtle">
                {formatAssetAmount(stats.endHoldings, decimals)} {asset.unit}
                {!hasActivity && ' · بدون فعالیت'}
              </span>
            </span>
          </span>
        }
        summary={total !== null ? <Amount value={total} currency={currencyMode} size="sm" signed tone="auto" compact /> : '—'}
      >
        <div className="space-y-3 pb-4">
          {hasActivity ? (
            <div className="grid grid-cols-2 gap-2">
              <TradeBox in label="خرید دوره" side={stats.bought} unit={asset.unit} decimals={decimals} currencyMode={currencyMode} />
              <TradeBox label="فروش دوره" side={stats.sold} unit={asset.unit} decimals={decimals} currencyMode={currencyMode} />
            </div>
          ) : (
            <Text variant="caption" tone="subtle">
              در این دوره تراکنشی نیست.
            </Text>
          )}
          {(stats.invalidTradeCount > 0 || stats.oversellCount > 0) && (
            <Text variant="caption" tone="negative">
              {stats.invalidTradeCount > 0 && `${stats.invalidTradeCount.toLocaleString('fa-IR')} رکورد نامعتبر`}
              {stats.invalidTradeCount > 0 && stats.oversellCount > 0 && ' · '}
              {stats.oversellCount > 0 && `${stats.oversellCount.toLocaleString('fa-IR')} فروش بیش از موجودی`}
            </Text>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Fact label="محقق‌شده">
              <Amount value={realized} currency={currencyMode} size="sm" signed tone="auto" compact />
            </Fact>
            <Fact label="باز" hint={staleDate ? `قیمت: ${formatJalaaliHuman(staleDate)}` : undefined} warn={!!staleDate}>
              {stats.periodUnrealizedAvailable ? <Amount value={unrealized} currency={currencyMode} size="sm" signed tone="auto" compact /> : '—'}
            </Fact>
          </div>
          {stats.endHoldings > 0 && (
            <Fact label="میانگین قیمت خرید (پایان دوره)">
              <Amount value={currencyMode === 'USD' ? stats.endAvgCostUsd : stats.endAvgCostToman} currency={currencyMode} size="sm" compact />
            </Fact>
          )}
        </div>
      </Disclosure>
    </div>
  );
}

function TradeBox({
  in: isIn,
  label,
  side,
  unit,
  decimals,
  currencyMode,
}: {
  in?: boolean;
  label: string;
  side: { units: number; avgPriceToman: number; avgPriceUsd: number; count: number };
  unit: string;
  decimals: number;
  currencyMode: CurrencyMode;
}) {
  return (
    <div className={cn('space-y-1 rounded-control bg-sunken p-3', side.units === 0 && 'opacity-50')}>
      <span className="flex items-center gap-1 text-caption text-fg-subtle">
        {isIn ? <ArrowDownLeft className="size-3.5 text-positive-ink" /> : <ArrowUpLeft className="size-3.5 text-negative-ink" />}
        {label} ({side.count.toLocaleString('fa-IR')})
      </span>
      <Text variant="callout" weight="semibold" className="tabular">
        {formatAssetAmount(side.units, decimals)} <span className="text-caption text-fg-subtle">{unit}</span>
      </Text>
      <span className="flex items-center gap-1 text-caption text-fg-subtle">
        میانگین <Amount value={currencyMode === 'USD' ? side.avgPriceUsd : side.avgPriceToman} currency={currencyMode} size="xs" compact />
      </span>
    </div>
  );
}
