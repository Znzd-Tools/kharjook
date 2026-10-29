'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Receipt } from 'lucide-react';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { TransactionHistorySearchBar } from '@/features/transactions/components/TransactionHistorySearchBar';
import {
  TransactionHistoryTypeFilter,
  type TxHistoryTypeFilter,
} from '@/features/transactions/components/TransactionHistoryTypeFilter';
import {
  ConvertListItem,
  TransactionListItem,
} from '@/features/transactions/components/TransactionListItem';
import {
  groupConvertTransactions,
  transactionIdsInConvertGroups,
} from '@/features/transactions/utils/convert-transaction';
import { transactionMatchesSearch } from '@/features/transactions/utils/transaction-history-search';
import { downloadTransactionCsv } from '@/features/transactions/utils/export-transaction-csv';
import { PeriodNavHeader } from '@/features/reports/components/PeriodNavHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { RouteSkeleton } from '@/shared/components/RouteSkeleton';
import { IconButton, ListGroup, Money, Page, Stat } from '@/shared/components/ui';
import { formatCurrency } from '@/shared/utils/format-currency';
import { addDays, formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { currentPeriod, isInPeriod, type Period } from '@/shared/utils/period';

const PAGE_SIZE = 60;

export function TransactionsTab() {
  const router = useRouter();
  const {
    transactions,
    wallets,
    assets,
    categories,
    persons,
    isLoadingData,
    transactionsFullyLoaded,
  } = useData();
  const { currencyMode } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TxHistoryTypeFilter>('ALL');
  const [period, setPeriod] = useState<Period>(() => currentPeriod('month'));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const lookup = useMemo(
    () => ({ wallets, assets, categories, persons }),
    [wallets, assets, categories, persons]
  );

  const convertGroups = useMemo(() => groupConvertTransactions(transactions), [transactions]);
  const convertTxIds = useMemo(() => transactionIdsInConvertGroups(transactions), [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (convertTxIds.has(tx.id)) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (!isInPeriod(tx.date_string, period)) return false;
      return transactionMatchesSearch(tx, searchQuery, lookup);
    });
  }, [transactions, convertTxIds, typeFilter, period, searchQuery, lookup]);

  const filteredGroups = useMemo(() => {
    return convertGroups.filter((group) => {
      if (typeFilter !== 'ALL' && typeFilter !== 'SELL' && typeFilter !== 'BUY') return false;
      if (!isInPeriod(group.sell.date_string, period)) return false;
      const haystack = `${group.sell.note ?? ''} ${group.buy.note ?? ''}`;
      if (searchQuery.trim() && !haystack.includes(searchQuery.trim())) return false;
      return true;
    });
  }, [convertGroups, typeFilter, period, searchQuery]);

  const sortedItems = useMemo(() => {
    const singles = filtered.map((tx) => ({ kind: 'single' as const, date: tx.date_string, tx }));
    const converts = filteredGroups.map((group) => ({
      kind: 'convert' as const,
      date: group.sell.date_string,
      group,
    }));
    return [...singles, ...converts].sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered, filteredGroups]);

  // Cashflow of the filtered rows, from the snapshot taken when each was saved.
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      const v = Number(currencyMode === 'USD' ? tx.amount_usd_at_time : tx.amount_toman_at_time);
      if (!Number.isFinite(v)) continue;
      if (tx.type === 'INCOME') income += v;
      if (tx.type === 'EXPENSE') expense += v;
    }
    return { income, expense };
  }, [filtered, currencyMode]);

  const days = useMemo(() => {
    const out: { date: string; items: typeof sortedItems }[] = [];
    for (const item of sortedItems.slice(0, visibleCount)) {
      const last = out[out.length - 1];
      if (last && last.date === item.date) last.items.push(item);
      else out.push({ date: item.date, items: [item] });
    }
    return out;
  }, [sortedItems, visibleCount]);

  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);
  const yesterdayStr = useMemo(() => formatJalaali(addDays(todayJalaali(), -1)), []);
  const dayLabel = (date: string) => {
    if (date === todayStr) return 'امروز';
    if (date === yesterdayStr) return 'دیروز';
    const parsed = parseJalaali(date);
    return parsed ? formatJalaaliHuman(parsed) : date;
  };

  if (isLoadingData && transactions.length === 0) {
    return <RouteSkeleton blocks={5} />;
  }

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  return (
    <Page className="space-y-5">
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <TransactionHistorySearchBar
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v);
              resetPaging();
            }}
          />
        </div>
        <IconButton
          label="خروجی CSV"
          onClick={() => downloadTransactionCsv(transactions, wallets, assets, categories)}
        >
          <Download size={18} strokeWidth={1.75} />
        </IconButton>
      </div>

      <TransactionHistoryTypeFilter
        value={typeFilter}
        onChange={(v) => {
          setTypeFilter(v);
          resetPaging();
        }}
      />

      <PeriodNavHeader
        period={period}
        onChange={(p) => {
          setPeriod(p);
          resetPaging();
        }}
      />

      {(totals.income > 0 || totals.expense > 0) && (
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-surface-raised p-4">
          <Stat label="درآمد" value={formatCurrency(totals.income, currencyMode)} tone="positive" />
          <Stat label="هزینه" value={formatCurrency(totals.expense, currencyMode)} tone="negative" />
          <Stat
            label="خالص"
            value={`${totals.income - totals.expense >= 0 ? '+' : ''}${formatCurrency(
              totals.income - totals.expense,
              currencyMode
            )}`}
          />
        </div>
      )}

      {!transactionsFullyLoaded && (
        <p className="flex items-center gap-2 px-1 text-xs text-zinc-500">
          <Loader2 size={12} className="animate-spin" />
          در حال بارگذاری تاریخچه کامل...
        </p>
      )}

      {sortedItems.length === 0 ? (
        <EmptyState
          icon={<Receipt size={22} />}
          title={transactions.length === 0 ? 'هنوز تراکنشی ثبت نشده.' : 'در این بازه تراکنشی نیست.'}
          description={
            transactions.length === 0
              ? 'اولین هزینه یا درآمدت را ثبت کن.'
              : 'بازه، نوع یا متن جستجو را تغییر بده.'
          }
          actionLabel={transactions.length === 0 ? 'ثبت تراکنش' : undefined}
          onAction={transactions.length === 0 ? () => router.push('/transactions/new') : undefined}
        />
      ) : (
        <div className="space-y-5">
          {days.map((day) => (
            <section key={day.date} className="space-y-2">
              <h3 className="px-1 text-xs font-medium text-zinc-500">{dayLabel(day.date)}</h3>
              <ListGroup>
                {day.items.map((item) =>
                  item.kind === 'convert' ? (
                    <ConvertListItem
                      key={item.group.operationId}
                      group={item.group}
                      lookup={lookup}
                      href={`/transactions/${item.group.sell.id}/edit`}
                    />
                  ) : (
                    <TransactionListItem
                      key={item.tx.id}
                      tx={item.tx}
                      lookup={lookup}
                      href={`/transactions/${item.tx.id}/edit`}
                    />
                  )
                )}
              </ListGroup>
            </section>
          ))}
          {sortedItems.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="h-11 w-full rounded-xl bg-white/5 text-sm font-medium text-zinc-300 hover:bg-white/8"
            >
              نمایش بیشتر ·{' '}
              <Money className="text-zinc-500">{sortedItems.length - visibleCount}</Money> مورد دیگر
            </button>
          )}
        </div>
      )}
    </Page>
  );
}
