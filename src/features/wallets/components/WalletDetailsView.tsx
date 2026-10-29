'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, CreditCard, Plus, Wallet as WalletIcon } from 'lucide-react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { EmptyState } from '@/shared/components/EmptyState';
import type { Transaction, Wallet } from '@/shared/types/domain';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { walletRateNow } from '@/features/rates/utils/wallet-rate';
import { formatCurrency, formatCurrencyAmount } from '@/shared/utils/format-currency';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import {
  ConvertListItem,
  TransactionListItem,
} from '@/features/transactions/components/TransactionListItem';
import {
  convertGroupsForWallet,
  groupConvertTransactions,
  transactionIdsInConvertGroups,
  type ConvertTransactionGroup,
} from '@/features/transactions/utils/convert-transaction';
import { Card, ListGroup, Money, PageHeader, Section, Stat } from '@/shared/components/ui';
import { CopyableDetailRow } from '@/features/wallets/components/CopyableDetailRow';
import { WalletPaymentDetailsSheet } from '@/features/wallets/components/WalletPaymentDetailsSheet';
import { WalletSavingsPotsSection } from '@/features/wallets/components/WalletSavingsPotsSection';
import {
  formatCardNumber,
  formatIban,
  walletHasPaymentDetails,
} from '@/features/wallets/utils/wallet-payment-details';
import {
  TransactionHistoryTypeFilter,
  type TxHistoryTypeFilter,
} from '@/features/transactions/components/TransactionHistoryTypeFilter';
import { TransactionHistorySearchBar } from '@/features/transactions/components/TransactionHistorySearchBar';
import {
  convertGroupMatchesSearch,
  transactionMatchesSearch,
} from '@/features/transactions/utils/transaction-history-search';

export interface WalletDetailsViewProps {
  walletId: string;
}

export function WalletDetailsView({ walletId }: WalletDetailsViewProps) {
  const router = useRouter();
  const {
    wallets,
    assets,
    categories,
    persons,
    transactions,
    setWallets,
    currencyRates,
  } = useData();
  const { currencyMode, usdRate } = useUI();
  const rateHistories = useRateHistories();
  const [txTypeFilter, setTxTypeFilter] = useState<TxHistoryTypeFilter>('ALL');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  const wallet = wallets.find((w) => w.id === walletId);

  const stats = useMemo(
    () => (wallet ? calculateWalletStats(wallet, transactions) : null),
    [wallet, transactions]
  );

  const visibleWalletTxs = useMemo(() => {
    if (!stats) return [];
    const txs = stats.transactions;
    if (txTypeFilter === 'ALL') return txs;
    return txs.filter((tx) => tx.type === txTypeFilter);
  }, [stats, txTypeFilter]);

  const convertGroups = useMemo(
    () =>
      stats
        ? convertGroupsForWallet(walletId, groupConvertTransactions(transactions))
        : [],
    [stats, walletId, transactions]
  );
  const convertTxIds = useMemo(
    () => transactionIdsInConvertGroups(transactions),
    [transactions]
  );
  const historyLookup = useMemo(
    () => ({ wallets, assets, categories, persons }),
    [wallets, assets, categories, persons]
  );

  const walletHistoryItems = useMemo(() => {
    if (!stats) return [];
    type HistoryItem =
      | { kind: 'convert'; date: string; group: ConvertTransactionGroup }
      | { kind: 'tx'; date: string; tx: Transaction };
    const items: HistoryItem[] = [];
    for (const group of convertGroups) {
      if (txTypeFilter !== 'ALL') {
        const matches =
          (txTypeFilter === 'SELL' && group.sell.target_wallet_id === walletId) ||
          (txTypeFilter === 'BUY' && group.buy.source_wallet_id === walletId);
        if (!matches) continue;
      }
      if (!convertGroupMatchesSearch(group, txSearchQuery, historyLookup)) continue;
      items.push({ kind: 'convert', date: group.sell.date_string, group });
    }
    for (const tx of visibleWalletTxs) {
      if (convertTxIds.has(tx.id)) continue;
      if (!transactionMatchesSearch(tx, txSearchQuery, historyLookup)) continue;
      items.push({ kind: 'tx', date: tx.date_string, tx });
    }
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [
    stats,
    convertGroups,
    visibleWalletTxs,
    convertTxIds,
    txTypeFilter,
    txSearchQuery,
    historyLookup,
    walletId,
  ]);

  if (!wallet || !stats) {
    return (
      <div className="bg-surface-inset min-h-full flex items-center justify-center p-6">
        <div className="text-center text-zinc-500 text-sm">
          کیف پول پیدا نشد.
        </div>
      </div>
    );
  }

  const meta = CURRENCY_META[wallet.currency];
  const { rate } = walletRateNow(wallet.currency, currencyRates, rateHistories);
  const balanceToman = stats.balance * rate;
  const balanceDisplay =
    currencyMode === 'USD' && usdRate > 0
      ? balanceToman / usdRate
      : balanceToman;

  const hasPaymentDetails = walletHasPaymentDetails(wallet);

  const updateWallet = (next: Wallet) => {
    setWallets((prev) => prev.map((w) => (w.id === next.id ? next : w)));
  };

  const nativeAmount = (v: number) =>
    wallet.currency === 'IRT'
      ? `${formatCurrencyAmount(v, wallet.currency)} ت`
      : `${meta.symbol}${formatCurrencyAmount(v, wallet.currency)}`;

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title={wallet.name} subtitle={meta.label} />

      <div className="px-4 pt-5 space-y-7">
        <section className="px-1">
          <div className="flex items-center gap-3">
            <EntityIcon
              iconUrl={wallet.icon_url}
              fallback={<WalletIcon size={20} />}
              bgColor="rgba(255,255,255,0.06)"
              color="#d4d4d8"
              className="h-11 w-11 rounded-full!"
            />
            <p className="text-xs text-zinc-500">موجودی فعلی</p>
          </div>
          <p className="mt-4 text-[2.25rem] leading-tight font-semibold tracking-tight text-zinc-50">
            <Money tone={stats.balance < 0 ? 'negative' : 'neutral'}>{nativeAmount(stats.balance)}</Money>
          </p>
          {wallet.currency !== 'IRT' && (
            <p className="mt-1 text-sm text-zinc-500">
              ≈ <Money>{formatCurrency(balanceDisplay, currencyMode)}</Money>
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => router.push(`/transactions/new?walletId=${wallet.id}`)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-50 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              <Plus size={17} />
              تراکنش جدید
            </button>
            <button
              type="button"
              onClick={() => router.push(`/transactions/new?walletId=${wallet.id}&type=TRANSFER`)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/6 text-sm font-semibold text-zinc-100 hover:bg-white/10"
            >
              <ArrowLeftRight size={17} />
              انتقال
            </button>
          </div>
        </section>

        <Card className="grid grid-cols-2 gap-x-3 gap-y-4">
          <Stat label="جمع درآمد" value={nativeAmount(stats.incomeTotal)} tone="positive" />
          <Stat label="جمع هزینه" value={nativeAmount(stats.expenseTotal)} tone="negative" />
          <Stat
            label="جریان خالص"
            value={`${stats.netFlow >= 0 ? '+' : ''}${nativeAmount(stats.netFlow)}`}
          />
          <Stat label="موجودی اولیه" value={nativeAmount(wallet.initial_balance)} />
        </Card>

        <WalletSavingsPotsSection wallet={wallet} walletBalance={stats.balance} />

        <Section
          title={
            <span className="flex items-center gap-1.5">
              <CreditCard size={15} className="text-zinc-400" />
              اطلاعات حساب
            </span>
          }
          action={{ label: hasPaymentDetails ? 'ویرایش' : 'افزودن', onClick: () => setPaymentSheetOpen(true) }}
        >
          {hasPaymentDetails ? (
            <div className="space-y-2">
              {wallet.account_owner_name && (
                <CopyableDetailRow label="نام صاحب حساب" value={wallet.account_owner_name} valueDir="auto" />
              )}
              {wallet.card_number && (
                <CopyableDetailRow
                  label="شماره کارت"
                  value={formatCardNumber(wallet.card_number)}
                  copyValue={wallet.card_number}
                />
              )}
              {wallet.account_number && (
                <CopyableDetailRow
                  label="شماره حساب"
                  value={wallet.account_number}
                  copyValue={wallet.account_number}
                />
              )}
              {wallet.iban && (
                <CopyableDetailRow label="شبا" value={formatIban(wallet.iban)} copyValue={wallet.iban} />
              )}
            </div>
          ) : (
            <Card>
              <p className="text-xs leading-relaxed text-zinc-500">
                نام صاحب حساب، شماره کارت، حساب یا شبا را اضافه کن تا با یک لمس کپی شود.
              </p>
            </Card>
          )}
        </Section>

        <Section title="تاریخچه">
          {stats.transactions.length > 4 && (
            <div className="space-y-3">
              <TransactionHistorySearchBar value={txSearchQuery} onChange={setTxSearchQuery} />
              <TransactionHistoryTypeFilter value={txTypeFilter} onChange={setTxTypeFilter} />
            </div>
          )}
          {stats.transactions.length === 0 ? (
            <EmptyState
              icon={<WalletIcon size={22} />}
              title="هنوز تراکنشی برای این کیف پول ثبت نشده."
              actionLabel="ثبت تراکنش"
              onAction={() => router.push(`/transactions/new?walletId=${wallet.id}`)}
            />
          ) : walletHistoryItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              {txSearchQuery.trim() ? 'تراکنشی با این جستجو پیدا نشد.' : 'تراکنشی با این نوع وجود ندارد.'}
            </p>
          ) : (
            <ListGroup>
              {walletHistoryItems.map((item) =>
                item.kind === 'convert' ? (
                  <ConvertListItem
                    key={item.group.operationId}
                    group={item.group}
                    lookup={historyLookup}
                    href={`/transactions/${item.group.sell.id}/edit`}
                  />
                ) : (
                  <TransactionListItem
                    key={item.tx.id}
                    tx={item.tx}
                    lookup={historyLookup}
                    href={`/transactions/${item.tx.id}/edit`}
                    showDate
                  />
                )
              )}
            </ListGroup>
          )}
        </Section>
      </div>

      <WalletPaymentDetailsSheet
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        wallet={wallet}
        onSaved={updateWallet}
      />
    </div>
  );
}
