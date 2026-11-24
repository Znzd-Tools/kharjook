'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Amount, Banner, CalendarHeatmap, Chip, ChipGroup, DonutChart, EmptyState, List, ListRow, Text, cn, type HeatDay } from '@/design-system';
import { ChevronDown, LayoutGrid as FolderOpen } from '@/design-system/icons';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import type { CurrencyMode } from '@/shared/types/domain';
import {
  clampPeriodToToday,
  decodePeriodParams,
  encodePeriodParams,
  type Period,
} from '@/shared/utils/period';
import { PeriodNavHeader } from '@/features/reports/components/PeriodNavHeader';
import { ReportExportButton } from '@/features/reports/components/ReportExportButton';
import {
  buildCashflowCsv,
  cashflowCsvFilename,
} from '@/features/reports/utils/export-cashflow-csv';
import { downloadCsv } from '@/shared/utils/download-csv';
import { addDays, formatJalaali, formatJalaaliHuman, jalaaliWeekday } from '@/shared/utils/jalali';
import { cmpJalaali } from '@/shared/utils/period';
import {
  dailyCashflow,
  rollupCategories,
  type CashflowKind,
  type RollupNode,
  type RollupResult,
} from '@/features/reports/utils/category-rollup';

type Tab = CashflowKind;

export function CashflowReportView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { transactions, categories, wallets } = useData();
  const { currencyMode } = useUI();

  const period = useMemo(
    () => clampPeriodToToday(decodePeriodParams(searchParams.get('period'), searchParams.get('d'))),
    [searchParams]
  );
  const tab: Tab = (searchParams.get('tab') === 'income' ? 'income' : 'expense');
  const walletId = searchParams.get('wallet') || null;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const pushParams = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`/reports/cashflow?${sp.toString()}`, { scroll: false });
    setExpanded(new Set()); // reset drill state on filter change
  };

  const setPeriod = (p: Period) => {
    const { period, d } = encodePeriodParams(p);
    pushParams({ period, d });
  };
  const setTab = (t: Tab) => pushParams({ tab: t });
  const setWallet = (w: string | null) => pushParams({ wallet: w });

  const incomeRollup = useMemo(
    () =>
      rollupCategories({
        transactions, categories, wallets,
        period, kind: 'income', walletId, currencyMode,
      }),
    [transactions, categories, wallets, period, walletId, currencyMode]
  );
  const expenseRollup = useMemo(
    () =>
      rollupCategories({
        transactions, categories, wallets,
        period, kind: 'expense', walletId, currencyMode,
      }),
    [transactions, categories, wallets, period, walletId, currencyMode]
  );

  const active = tab === 'income' ? incomeRollup : expenseRollup;

  // Donut: top-level categories (with their children rolled in), own colors.
  const donut = useMemo(() => {
    const segs = active.nodes
      .filter((n) => n.depth === 0 && n.rolled > 0)
      .map((n) => ({ key: n.id, label: n.name, value: n.rolled, color: n.color }));
    if (active.uncategorized.total > 0)
      segs.push({ key: '__uncat', label: 'بدون دسته‌بندی', value: active.uncategorized.total, color: 'var(--color-chart-other)' });
    return segs;
  }, [active]);

  // Heatmap: one cell per day, for a week or a month only.
  const heat = useMemo<HeatDay[] | null>(() => {
    if (period.kind !== 'month' && period.kind !== 'week') return null;
    const byDay = dailyCashflow({ transactions, period, kind: tab, walletId, currencyMode });
    const out: HeatDay[] = [];
    for (let d = period.start; cmpJalaali(d, period.end) <= 0; d = addDays(d, 1)) {
      const key = formatJalaali(d);
      out.push({ key, day: d.jd, weekday: jalaaliWeekday(d), value: byDay.get(key) ?? 0, label: formatJalaaliHuman(d) });
    }
    return out;
  }, [transactions, period, tab, walletId, currencyMode]);

  const exportCsv = () => {
    const walletLabel =
      walletId != null
        ? (wallets.find((w) => w.id === walletId)?.name ?? 'کیف پول')
        : 'همه کیف‌ها';
    downloadCsv(
      cashflowCsvFilename(period),
      buildCashflowCsv({
        period,
        currencyMode,
        walletLabel,
        income: incomeRollup,
        expense: expenseRollup,
      })
    );
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const net = incomeRollup.total - expenseRollup.total;

  return (
    <div className="space-y-4 px-(--ds-gutter) pt-1 pb-6">
      <div className="flex items-center justify-between gap-2">
        <Text variant="title" weight="semibold">
          درآمد و هزینه
        </Text>
        <ReportExportButton onClick={exportCsv} />
      </div>

      <PeriodNavHeader period={period} onChange={setPeriod} />

      {wallets.length > 0 && (
        <ChipGroup aria-label="کیف پول" value={[walletId ?? '__all']} onValueChange={(v) => v[0] && setWallet(v[0] === '__all' ? null : v[0])}>
          <Chip value="__all">همه کیف‌ها</Chip>
          {wallets.map((w) => (
            <Chip key={w.id} value={w.id}>
              {w.name}
            </Chip>
          ))}
        </ChipGroup>
      )}

      <section aria-label="مانده دوره" className="rounded-card bg-panel p-4">
        <Text variant="caption" tone="subtle">
          مانده دوره
        </Text>
        <Amount value={net} currency={currencyMode} size="hero" signed tone="auto" />
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab('income')}
          aria-pressed={tab === 'income'}
          className={cn('ds-focus flex flex-col items-start gap-1 rounded-card p-3 text-start', tab === 'income' ? 'bg-positive-soft' : 'bg-panel')}
        >
          <Text variant="caption" tone="subtle">
            درآمد
          </Text>
          <Amount value={incomeRollup.total} currency={currencyMode} size="md" compact tone="positive" />
        </button>
        <button
          type="button"
          onClick={() => setTab('expense')}
          aria-pressed={tab === 'expense'}
          className={cn('ds-focus flex flex-col items-start gap-1 rounded-card p-3 text-start', tab === 'expense' ? 'bg-negative-soft' : 'bg-panel')}
        >
          <Text variant="caption" tone="subtle">
            هزینه
          </Text>
          <Amount value={expenseRollup.total} currency={currencyMode} size="md" compact tone="negative" />
        </button>
      </div>

      {donut.length > 0 && (
        <section aria-label="سهم دسته‌ها" className="rounded-card bg-panel p-4">
          <DonutChart
            aria-label={tab === 'income' ? 'سهم دسته‌های درآمد' : 'سهم دسته‌های هزینه'}
            segments={donut}
            center={
              <>
                <span className="text-micro text-fg-subtle">{tab === 'income' ? 'درآمد' : 'هزینه'}</span>
                <Amount value={active.total} currency={currencyMode} size="sm" compact />
              </>
            }
            formatValue={(v) => <Amount value={v} currency={currencyMode} size="xs" compact />}
          />
        </section>
      )}

      {heat && heat.some((d) => d.value > 0) && (
        <section aria-label={tab === 'income' ? 'درآمد هر روز' : 'خرج هر روز'} className="rounded-card bg-panel p-4">
          <CalendarHeatmap
            aria-label={tab === 'income' ? 'درآمد هر روز' : 'خرج هر روز'}
            days={heat}
            tone={tab === 'income' ? 'positive' : 'negative'}
            formatValue={(v) => <Amount value={v} currency={currencyMode} size="xs" compact />}
          />
        </section>
      )}

      <CategoryList
        result={active}
        tab={tab}
        expanded={expanded}
        onToggle={toggle}
        currencyMode={currencyMode}
        drillHref={(categoryId) =>
          `/transactions?${new URLSearchParams({
            category: categoryId,
            type: tab === 'income' ? 'INCOME' : 'EXPENSE',
            from: formatJalaali(period.start),
            to: formatJalaali(period.end),
          }).toString()}`
        }
      />

      {active.unpricedCount > 0 && (
        <Banner tone="warning">
          {active.unpricedCount.toLocaleString('fa-IR')} تراکنش بدون قیمت لحظه‌ای ثبت شده و در جمع نیامده. با ویرایش و ثبت قیمت، عدد دقیق می‌شود.
        </Banner>
      )}
    </div>
  );
}

function CategoryList({
  result,
  tab,
  expanded,
  onToggle,
  currencyMode,
  drillHref,
}: {
  result: RollupResult;
  tab: Tab;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  currencyMode: CurrencyMode;
  /** Ledger link for one category in this period (report drill-down). */
  drillHref: (categoryId: string) => string;
}) {
  const { nodes, uncategorized } = result;
  const visibleNodes = useMemoVisible(nodes, expanded);
  const tone = tab === 'income' ? 'positive' : 'negative';

  if (nodes.length === 0 && uncategorized.total === 0) {
    return (
      <div className="rounded-card bg-panel">
        <EmptyState icon={<FolderOpen />} title={`در این بازه ${tab === 'income' ? 'درآمدی' : 'هزینه‌ای'} ثبت نشده`} />
      </div>
    );
  }

  return (
    <List>
      {visibleNodes.map((n) => {
        const value = n.depth === 0 ? n.rolled : n.own;
        const empty = value === 0;
        const common = {
          chevron: false,
          className: cn(empty && 'opacity-50'),
          style: { paddingInlineStart: `${16 + n.depth * 16}px` },
          leading: (
            <span className="flex items-center gap-1.5">
              {n.hasChildren ? (
                <ChevronDown className={cn('size-3.5 text-fg-subtle transition-transform', !expanded.has(n.id) && 'rotate-90')} />
              ) : (
                <span className="w-3.5" />
              )}
              <span className="size-2.5 rounded-full" style={{ backgroundColor: n.color }} />
            </span>
          ),
          title: n.name,
          trailing: <Amount value={value} currency={currencyMode} size="sm" compact tone={empty ? 'muted' : tone} />,
        };
        return n.hasChildren ? (
          <ListRow key={n.id} {...common} onClick={() => onToggle(n.id)} aria-expanded={expanded.has(n.id)} />
        ) : (
          <ListRow key={n.id} {...common} render={<Link href={drillHref(n.id)} aria-label={`تراکنش‌های ${n.name}`} />} />
        );
      })}
      {uncategorized.total > 0 && (
        <ListRow
          chevron={false}
          leading={<span className="size-2.5 rounded-full bg-line-strong" />}
          title={`بدون دسته‌بندی (${uncategorized.count.toLocaleString('fa-IR')})`}
          trailing={<Amount value={uncategorized.total} currency={currencyMode} size="sm" compact tone={tone} />}
        />
      )}
    </List>
  );
}

function useMemoVisible(nodes: RollupNode[], expanded: Set<string>) {
  return useMemo(() => {
    const out: RollupNode[] = [];
    // Walk and skip subtrees whose parent is collapsed.
    const skipDepth: { depth: number } = { depth: -1 };
    for (const n of nodes) {
      if (skipDepth.depth !== -1 && n.depth > skipDepth.depth) continue;
      skipDepth.depth = -1;
      out.push(n);
      if (n.hasChildren && !expanded.has(n.id)) {
        skipDepth.depth = n.depth;
      }
    }
    return out;
  }, [nodes, expanded]);
}

