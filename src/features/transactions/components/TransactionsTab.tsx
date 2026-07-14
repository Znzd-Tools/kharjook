'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { TransactionHistorySearchBar } from '@/features/transactions/components/TransactionHistorySearchBar';
import {
  TransactionHistoryTypeFilter,
  type TxHistoryTypeFilter,
} from '@/features/transactions/components/TransactionHistoryTypeFilter';
import { ConvertTransactionCard } from '@/features/transactions/components/ConvertTransactionCard';
import {
  groupConvertTransactions,
  transactionIdsInConvertGroups,
} from '@/features/transactions/utils/convert-transaction';
import { transactionMatchesSearch } from '@/features/transactions/utils/transaction-history-search';
import { downloadTransactionCsv } from '@/features/transactions/utils/export-transaction-csv';
import { EmptyState } from '@/shared/components/EmptyState';
import { RouteSkeleton } from '@/shared/components/RouteSkeleton';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { currentPeriod } from '@/shared/utils/period';
import type { Transaction } from '@/shared/types/domain';
import { Receipt } from 'lucide-react';

function inDateRange(tx: Transaction, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (from && tx.date_string < from) return false;
  if (to && tx.date_string > to) return false;
  return true;
}

export function TransactionsTab() {
  const router = useRouter();
  const {
    transactions,
    wallets,
    assets,
    categories,
    isLoadingData,
    transactionsFullyLoaded,
  } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TxHistoryTypeFilter>('ALL');
  const today = useMemo(() => formatJalaali(todayJalaali()), []);
  const monthPeriod = useMemo(() => currentPeriod('month'), []);
  const [dateFrom, setDateFrom] = useState(formatJalaali(monthPeriod.start));
  const [dateTo, setDateTo] = useState(today);

  const lookup = useMemo(
    () => ({ wallets, assets, categories }),
    [wallets, assets, categories]
  );

  const convertGroups = useMemo(
    () => groupConvertTransactions(transactions),
    [transactions]
  );
  const convertTxIds = useMemo(
    () => transactionIdsInConvertGroups(transactions),
    [transactions]
  );

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (convertTxIds.has(tx.id)) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (!inDateRange(tx, dateFrom, dateTo)) return false;
      return transactionMatchesSearch(tx, searchQuery, lookup);
    });
  }, [transactions, convertTxIds, typeFilter, dateFrom, dateTo, searchQuery, lookup]);

  const filteredGroups = useMemo(() => {
    return convertGroups.filter((group) => {
      if (typeFilter !== 'ALL' && typeFilter !== 'SELL' && typeFilter !== 'BUY') {
        return false;
      }
      if (!inDateRange(group.sell, dateFrom, dateTo)) return false;
      const haystack = `${group.sell.note ?? ''} ${group.buy.note ?? ''}`;
      if (searchQuery.trim() && !haystack.includes(searchQuery.trim())) return false;
      return true;
    });
  }, [convertGroups, typeFilter, dateFrom, dateTo, searchQuery]);

  const sortedItems = useMemo(() => {
    const singles = filtered.map((tx) => ({
      kind: 'single' as const,
      date: tx.date_string,
      tx,
    }));
    const converts = filteredGroups.map((group) => ({
      kind: 'convert' as const,
      date: group.sell.date_string,
      group,
    }));
    return [...singles, ...converts].sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered, filteredGroups]);

  if (isLoadingData && transactions.length === 0) {
    return <RouteSkeleton blocks={5} />;
  }

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">تراکنش‌ها</h2>
        <button
          type="button"
          onClick={() =>
            downloadTransactionCsv(transactions, wallets, assets, categories)
          }
          disabled={transactions.length === 0}
          className="flex items-center gap-2 text-xs font-medium text-purple-300 hover:text-purple-200 bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-xl disabled:opacity-40"
        >
          <Download size={14} />
          خروجی CSV
        </button>
      </div>

      {!transactionsFullyLoaded && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" />
          در حال بارگذاری تاریخچه کامل...
        </p>
      )}

      <div className="space-y-3">
        <TransactionHistorySearchBar value={searchQuery} onChange={setSearchQuery} />
        <TransactionHistoryTypeFilter value={typeFilter} onChange={setTypeFilter} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">از تاریخ</span>
            <input
              type="text"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="1403/01/01"
              className="w-full bg-surface-raised border border-white/10 rounded-xl py-2 px-3 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">تا تاریخ</span>
            <input
              type="text"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="1403/12/29"
              className="w-full bg-surface-raised border border-white/10 rounded-xl py-2 px-3 text-sm text-white"
            />
          </label>
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <EmptyState
          icon={<Receipt size={24} />}
          title={
            transactions.length === 0
              ? 'هنوز تراکنشی ثبت نشده.'
              : 'تراکنشی با این فیلتر پیدا نشد.'
          }
          actionLabel={transactions.length === 0 ? 'ثبت تراکنش' : undefined}
          onAction={
            transactions.length === 0
              ? () => router.push('/transactions/new')
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) =>
            item.kind === 'convert' ? (
              <ConvertTransactionCard
                key={item.group.operationId}
                group={item.group}
                assets={assets}
                onEdit={() =>
                  router.push(`/transactions/${item.group.sell.id}/edit`)
                }
                onDelete={() => {}}
              />
            ) : (
              <button
                key={item.tx.id}
                type="button"
                onClick={() => router.push(`/transactions/${item.tx.id}/edit`)}
                className="w-full text-right bg-surface-raised border border-white/5 rounded-2xl p-4 hover:border-purple-500/20 transition-colors"
              >
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{item.tx.type}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.tx.date_string}</p>
                  </div>
                  <p className="text-sm text-slate-300" dir="ltr">
                    {item.tx.note || '—'}
                  </p>
                </div>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
