'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Coins,
  Info,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import type { CurrencyMode } from '@/shared/types/domain';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { formatCurrency } from '@/shared/utils/format-currency';
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
import { effectivePriceAt } from '@/features/reports/utils/price-history';
import type { Asset } from '@/shared/types/domain';

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

  // Compute per-asset stats once. Price lookup is O(n) in dailyPrices per
  // asset; with hundreds of snapshots × tens of assets still well under a
  // frame. Memoization keeps it off the render hot path.
  const allStats = useMemo(() => {
    const periodStartStr = formatJalaali(period.start);
    const periodEndStr = formatJalaali(period.end);
    return assets
      .filter((a) => a.include_in_profit_loss !== false)
      .map((a) => {
        const startPrice =
          period.kind === 'all'
            ? null
            : effectivePriceAt(a, periodStartStr, dailyPrices, todayStr);
        const endPrice = effectivePriceAt(a, periodEndStr, dailyPrices, todayStr);
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
  }, [assets, transactions, period, usdRate, dailyPrices, todayStr]);

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
    <div className="bg-[#161722] min-h-full">
      <header className="sticky top-0 z-10 bg-[#161722]/95 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="بازگشت"
          className="w-9 h-9 rounded-xl bg-[#1A1B26] border border-white/5 flex items-center justify-center text-slate-300 hover:bg-white/5"
        >
          <ChevronRight size={18} />
        </button>
        <h1 className="flex-1 text-base font-bold text-white">
          گزارش سود/زیان دارایی‌ها
        </h1>
        <ReportExportButton onClick={exportCsv} disabled={sorted.length === 0} />
      </header>

      <main className="p-4 space-y-4 pb-24">
        <PeriodNavHeader period={period} onChange={setPeriod} />

        <AssetFilterChips
          assets={assets}
          value={assetFilter}
          onChange={setAsset}
        />

        <SummaryCard
          totalToman={totals.realizedToman + totals.unrealizedToman}
          totalUsd={totals.realizedUsd + totals.unrealizedUsd}
          realizedToman={totals.realizedToman}
          realizedUsd={totals.realizedUsd}
          unrealizedToman={totals.unrealizedToman}
          unrealizedUsd={totals.unrealizedUsd}
          unrealizedMissingCount={totals.unrealizedMissingCount}
          invalidTradeCount={totals.invalidTradeCount}
          oversellCount={totals.oversellCount}
          buyCount={totals.buyCount}
          sellCount={totals.sellCount}
          periodEndLabel={periodEndLabel}
          currencyMode={currencyMode}
        />

        {sorted.length === 0 ? (
          <div className="bg-[#1A1B26] border border-white/5 rounded-2xl p-8 text-center">
            <Coins size={28} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">دارایی‌ای برای نمایش نیست.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(({ asset, stats }) => (
              <AssetRow key={asset.id} asset={asset} stats={stats} currencyMode={currencyMode} />
            ))}
          </div>
        )}

        {totals.unrealizedMissingCount > 0 && (
          <p className="text-[10px] text-slate-500 leading-relaxed px-2">
            برای {totals.unrealizedMissingCount.toLocaleString('fa-IR')} دارایی
            قیمت پایان دوره در دسترس نیست؛ سود/زیان باز آن‌ها در جمع لحاظ
            نشده. با ثبت قیمت روزانه یا تراکنش در آن روز، تاریخچه ساخته می‌شود.
          </p>
        )}
        {(totals.invalidTradeCount > 0 || totals.oversellCount > 0) && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-rose-300 mt-0.5 shrink-0" />
            <p className="text-[11px] text-rose-200 leading-relaxed">
              {totals.invalidTradeCount > 0 &&
                `${totals.invalidTradeCount.toLocaleString('fa-IR')} رکورد دارایی نامعتبر از محاسبه حذف شد.`}
              {totals.invalidTradeCount > 0 && totals.oversellCount > 0 && ' '}
              {totals.oversellCount > 0 &&
                `${totals.oversellCount.toLocaleString('fa-IR')} مورد فروش بیشتر از موجودی تشخیص داده شد.`}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function AssetFilterChips({
  assets,
  value,
  onChange,
}: {
  assets: Asset[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  if (assets.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition border ${
          value === null
            ? 'bg-purple-500/20 border-purple-500/40 text-white'
            : 'bg-[#1A1B26] border-white/5 text-slate-400 hover:text-white'
        }`}
      >
        همه دارایی‌ها
      </button>
      {assets.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition border ${
            value === a.id
              ? 'bg-purple-500/20 border-purple-500/40 text-white'
              : 'bg-[#1A1B26] border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          {a.name}
        </button>
      ))}
    </div>
  );
}

function SummaryCard({
  totalToman,
  totalUsd,
  realizedToman,
  realizedUsd,
  unrealizedToman,
  unrealizedUsd,
  unrealizedMissingCount,
  invalidTradeCount,
  oversellCount,
  buyCount,
  sellCount,
  periodEndLabel,
  currencyMode,
}: {
  totalToman: number;
  totalUsd: number;
  realizedToman: number;
  realizedUsd: number;
  unrealizedToman: number;
  unrealizedUsd: number;
  unrealizedMissingCount: number;
  invalidTradeCount: number;
  oversellCount: number;
  buyCount: number;
  sellCount: number;
  periodEndLabel: string;
  currencyMode: CurrencyMode;
}) {
  const [open, setOpen] = useState(false);
  const total = currencyMode === 'USD' ? totalUsd : totalToman;
  const positive = total >= 0;

  return (
    <div className="bg-[#1A1B26] border border-white/5 rounded-2xl p-4 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-right"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">سود/زیان کل دوره</span>
          <ChevronDown
            size={16}
            className={`text-slate-500 transition ${open ? 'rotate-180' : ''}`}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          {positive ? (
            <TrendingUp size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <TrendingDown size={18} className="text-rose-400 shrink-0" />
          )}
          <span
            className={`text-2xl font-black ${
              total === 0 ? 'text-slate-300' : positive ? 'text-emerald-400' : 'text-rose-400'
            }`}
            dir="ltr"
          >
            {total > 0 ? '+' : ''}
            {formatCurrency(total, currencyMode)}
          </span>
        </div>
        {unrealizedMissingCount > 0 && (
          <p className="text-[10px] text-amber-400/80 mt-1">
            {unrealizedMissingCount.toLocaleString('fa-IR')} دارایی بدون قیمت پایان دوره
          </p>
        )}
        {!open && (
          <p className="text-[10px] text-slate-500 mt-1">
            {buyCount} خرید · {sellCount} فروش — جزئیات
          </p>
        )}
      </button>

      {open && (
        <>
          <div className="border-t border-white/5" />
          <PnlLine
            label="محقق‌شده"
            value={currencyMode === 'USD' ? realizedUsd : realizedToman}
            tip="از تراکنش‌های فروش انجام‌شده در این دوره"
            currencyMode={currencyMode}
          />
          <div className="border-t border-white/5" />
          <PnlLine
            label={`باز — ${periodEndLabel}`}
            value={currencyMode === 'USD' ? unrealizedUsd : unrealizedToman}
            tip={
              unrealizedMissingCount > 0
                ? `${unrealizedMissingCount.toLocaleString('fa-IR')} دارایی بدون قیمت تاریخی لحاظ نشده`
                : 'بر اساس قیمت ثبت‌شده در پایان دوره'
            }
            warn={unrealizedMissingCount > 0}
            currencyMode={currencyMode}
          />
          <p className="text-[10px] text-slate-500">
            {buyCount} خرید · {sellCount} فروش
          </p>
          {(invalidTradeCount > 0 || oversellCount > 0) && (
            <div className="text-[10px] text-rose-300/90">
              {invalidTradeCount > 0 &&
                `${invalidTradeCount.toLocaleString('fa-IR')} رکورد نامعتبر`}
              {invalidTradeCount > 0 && oversellCount > 0 && ' · '}
              {oversellCount > 0 &&
                `${oversellCount.toLocaleString('fa-IR')} فروش بیشتر از موجودی`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PnlLine({
  label,
  value,
  tip,
  warn,
  currencyMode,
}: {
  label: string;
  value: number;
  tip: string;
  warn?: boolean;
  currencyMode: CurrencyMode;
}) {
  const positive = value >= 0;
  const color =
    value === 0 ? 'text-slate-300' : positive ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] text-slate-400">{label}</span>
        {warn && <AlertCircle size={11} className="text-amber-400" />}
      </div>
      <span className={`text-base font-bold ${color}`} dir="ltr">
        {value > 0 ? '+' : ''}
        {formatCurrency(value, currencyMode)}
      </span>
      <p className="text-[10px] text-slate-500 mt-0.5">{tip}</p>
    </div>
  );
}

function AssetRow({
  asset,
  stats,
  currencyMode,
}: {
  asset: Asset;
  stats: AssetPeriodStats;
  currencyMode: CurrencyMode;
}) {
  const [open, setOpen] = useState(false);
  const hasActivity = stats.hadActivity;
  const realizedPrimary = currencyMode === 'USD' ? stats.realizedUsd : stats.realizedToman;
  const unrealizedPrimary =
    currencyMode === 'USD' ? stats.periodUnrealizedUsd : stats.periodUnrealizedToman;
  const totalPrimary = stats.periodUnrealizedAvailable
    ? realizedPrimary + unrealizedPrimary
    : hasActivity
      ? realizedPrimary
      : null;
  const displayValue = totalPrimary ?? 0;
  const displayPositive = displayValue >= 0;
  const displayColor =
    displayValue === 0
      ? 'text-slate-500'
      : displayPositive
        ? 'text-emerald-400'
        : 'text-rose-400';
  const realizedColor =
    realizedPrimary === 0
      ? 'text-slate-500'
      : realizedPrimary >= 0
        ? 'text-emerald-400'
        : 'text-rose-400';

  const staleHint = useMemo(() => {
    if (!stats.periodUnrealizedAvailable) return null;
    if (!stats.periodEndPriceSourceDate) return null;
    const src = parseJalaali(stats.periodEndPriceSourceDate);
    if (!src) return null;
    return stats.periodEndPriceSourceDate;
  }, [stats.periodEndPriceSourceDate, stats.periodUnrealizedAvailable]);
  const decimals = assetDecimals(asset);

  return (
    <div className="bg-[#1A1B26] border border-white/5 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-right hover:bg-white/[0.02] transition"
      >
        <EntityIcon
          iconUrl={asset.icon_url}
          fallback={<Coins size={16} />}
          className="w-9 h-9 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{asset.name}</div>
          <div className="text-[10px] text-slate-500">
            {formatAssetAmount(stats.endHoldings, decimals)} {asset.unit}
            {!hasActivity && ' · بدون فعالیت'}
          </div>
        </div>
        <div className="text-left shrink-0 flex items-center gap-2">
          {totalPrimary !== null ? (
            <span className={`text-sm font-bold ${displayColor}`} dir="ltr">
              {displayValue > 0 ? '+' : ''}
              {formatCurrency(displayValue, currencyMode)}
            </span>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-500 transition ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
          {hasActivity ? (
            <div className="grid grid-cols-2 gap-2">
              <TradeBox
                icon={<ArrowDown size={12} className="text-emerald-400" />}
                label="خرید دوره"
                units={stats.bought.units}
                unit={asset.unit}
                decimals={decimals}
                avgToman={stats.bought.avgPriceToman}
                avgUsd={stats.bought.avgPriceUsd}
                count={stats.bought.count}
                empty={stats.bought.units === 0}
                currencyMode={currencyMode}
              />
              <TradeBox
                icon={<ArrowUp size={12} className="text-rose-400" />}
                label="فروش دوره"
                units={stats.sold.units}
                unit={asset.unit}
                decimals={decimals}
                avgToman={stats.sold.avgPriceToman}
                avgUsd={stats.sold.avgPriceUsd}
                count={stats.sold.count}
                empty={stats.sold.units === 0}
                currencyMode={currencyMode}
              />
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 bg-white/2 border border-white/5 rounded-lg px-3 py-2">
              در این دوره تراکنشی ثبت نشده.
            </div>
          )}

          {(stats.invalidTradeCount > 0 || stats.oversellCount > 0) && (
            <div className="text-[10px] text-rose-300/90 bg-rose-500/8 border border-rose-500/20 rounded-lg px-2 py-1.5">
              {stats.invalidTradeCount > 0 &&
                `${stats.invalidTradeCount.toLocaleString('fa-IR')} رکورد نامعتبر`}
              {stats.invalidTradeCount > 0 && stats.oversellCount > 0 && ' · '}
              {stats.oversellCount > 0 &&
                `${stats.oversellCount.toLocaleString('fa-IR')} فروش بیش از موجودی`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <MiniFact
              label="محقق‌شده"
              value={
                <span className={realizedColor}>
                  {realizedPrimary > 0 ? '+' : ''}
                  {formatCurrency(realizedPrimary, currencyMode)}
                </span>
              }
            />
            {stats.periodUnrealizedAvailable ? (
              <MiniFact
                label="باز"
                value={
                  <span
                    className={
                      unrealizedPrimary > 0
                        ? 'text-emerald-400'
                        : unrealizedPrimary < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                    }
                  >
                    {unrealizedPrimary > 0 ? '+' : ''}
                    {formatCurrency(unrealizedPrimary, currencyMode)}
                  </span>
                }
                hint={
                  staleHint && !stats.periodEndPriceIsLive
                    ? `قیمت: ${formatJalaaliHuman(parseJalaali(staleHint)!)}`
                    : undefined
                }
              />
            ) : (
              <MiniFact
                label="باز"
                value={
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    —
                    <Info size={11} className="text-slate-600" />
                  </span>
                }
              />
            )}
          </div>

          {stats.endHoldings > 0 && (
            <MiniFact
              label="میانگین قیمت خرید (پایان دوره)"
              value={formatCurrency(
                currencyMode === 'USD' ? stats.endAvgCostUsd : stats.endAvgCostToman,
                currencyMode
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TradeBox({
  icon,
  label,
  units,
  unit,
  decimals,
  avgToman,
  avgUsd,
  count,
  empty,
  currencyMode,
}: {
  icon: React.ReactNode;
  label: string;
  units: number;
  unit: string;
  decimals: number;
  avgToman: number;
  avgUsd: number;
  count: number;
  empty: boolean;
  currencyMode: CurrencyMode;
}) {
  const primary = currencyMode === 'USD' ? avgUsd : avgToman;
  return (
    <div
      className={`bg-white/2 border border-white/5 rounded-xl p-2.5 ${empty ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-slate-500">{label}</span>
        <span className="text-[10px] text-slate-600 mr-auto">({count})</span>
      </div>
      <div className="text-xs text-white">
        {formatAssetAmount(units, decimals)}{' '}
        <span className="text-[10px] text-slate-500">{unit}</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-1">میانگین قیمت</div>
      <div className="text-[11px] text-slate-300">
        {formatCurrency(primary, currencyMode)}
      </div>
    </div>
  );
}

function MiniFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-xs font-bold text-white">{value}</div>
      {hint && (
        <div className="text-[9px] text-amber-400/70 mt-0.5">{hint}</div>
      )}
    </div>
  );
}
