'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Amount,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  List,
  ListRow,
  Section,
  Text,
  TopBar,
  toast,
  useConfirm,
} from '@/design-system';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpLeft, CreditCard, Pencil, Plus, Trash2, Wallet as WalletIcon } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { NativeAmount } from './NativeAmount';
import { undoTransactionDelete } from '@/features/transactions/utils/transaction-undo';
import { supabase } from '@/shared/lib/supabase/client';
import type { Asset, Person, Transaction, TransactionType, Wallet } from '@/shared/types/domain';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { walletRateNow } from '@/features/rates/utils/wallet-rate';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import { DetailCard } from '@/features/assets/components/DetailCard';
import {
  ConvertTransactionCard,
  convertGroupsForWallet,
} from '@/features/transactions/components/ConvertTransactionCard';
import {
  groupConvertTransactions,
  transactionIdsInConvertGroups,
  type ConvertTransactionGroup,
} from '@/features/transactions/utils/convert-transaction';
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

const TYPE_LABELS: Record<TransactionType, string> = {
  BUY: 'خرید',
  SELL: 'فروش',
  TRANSFER: 'انتقال',
  INCOME: 'درآمد',
  EXPENSE: 'هزینه',
};

export interface WalletDetailsViewProps {
  walletId: string;
}

export function WalletDetailsView({ walletId }: WalletDetailsViewProps) {
  const router = useRouter();
  const goBack = useSafeBack('/wallets');
  const confirm = useConfirm();
  const {
    wallets,
    persons,
    assets,
    categories,
    transactions,
    setTransactions,
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
    () => ({ wallets, assets, categories }),
    [wallets, assets, categories]
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
      <div className="min-h-full bg-canvas">
        <TopBar onBack={goBack} title="کیف پول" />
        <EmptyState title="کیف پول پیدا نشد" />
      </div>
    );
  }

  const meta = CURRENCY_META[wallet.currency];
  const cur = wallet.currency;
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

  const deleteTx = async (id: string) => {
    if (!(await confirm({ title: 'این تراکنش حذف شود؟', confirmLabel: 'حذف', tone: 'danger' }))) return;
    const snapshot = transactions.find((tx) => tx.id === id);
    if (!snapshot) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      toast.success('تراکنش حذف شد.', {
        timeout: 8000,
        action: {
          label: 'بازگردانی',
          onClick: () => {
            void undoTransactionDelete(snapshot, (restored) => {
              setTransactions((prev) => [restored, ...prev]);
            }).then((result) => {
              if (!result.ok) toast.error(result.error);
              else toast.show('تراکنش بازگردانده شد.');
            });
          },
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('خطا در حذف رکورد.');
    }
  };

  const deleteConvert = async (group: ConvertTransactionGroup) => {
    if (!(await confirm({ title: 'این تبدیل حذف شود؟', description: 'هر دو بخش (فروش و خرید) حذف می‌شوند.', confirmLabel: 'حذف', tone: 'danger' }))) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', [group.sell.id, group.buy.id]);
      if (error) throw error;
      setTransactions((prev) =>
        prev.filter((tx) => tx.id !== group.sell.id && tx.id !== group.buy.id)
      );
    } catch (err) {
      console.error(err);
      toast.error('خطا در حذف تبدیل.');
    }
  };

  return (
    <div className="min-h-full bg-canvas pb-32">
      <TopBar onBack={goBack} title={wallet.name} />

      <div className="space-y-5 px-(--ds-gutter)">
        <section aria-label="موجودی" className="flex flex-col items-center gap-2 rounded-card bg-panel p-5 text-center">
          <Avatar size="lg" src={wallet.icon_url} name={wallet.name} fallback={<WalletIcon />} tone="lilac" />
          <Text variant="caption" tone="subtle">
            موجودی فعلی · {meta.label}
          </Text>
          <NativeAmount value={stats.balance} currency={cur} size="hero" />
          {cur !== (currencyMode === 'USD' ? 'USD' : 'IRT') && (
            <span className="text-caption text-fg-subtle">
              ≈ <Amount value={balanceDisplay} currency={currencyMode} size="xs" compact />
            </span>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <DetailCard label="موجودی اولیه" value={<NativeAmount value={wallet.initial_balance} currency={cur} size="sm" compact />} />
          <DetailCard label="جریان خالص" value={<NativeAmount value={stats.netFlow} currency={cur} size="sm" compact signed tone="auto" />} />
          <DetailCard label="جمع درآمد" value={<NativeAmount value={stats.incomeTotal} currency={cur} size="sm" compact />} />
          <DetailCard label="جمع هزینه" value={<NativeAmount value={stats.expenseTotal} currency={cur} size="sm" compact />} />
        </div>

        <WalletSavingsPotsSection wallet={wallet} walletBalance={stats.balance} />

        <Section
          title="اطلاعات حساب"
          action={
            <Button variant="link" size="sm" onClick={() => setPaymentSheetOpen(true)}>
              {hasPaymentDetails ? 'ویرایش' : 'افزودن'}
            </Button>
          }
        >
          {hasPaymentDetails ? (
            <List>
              {wallet.account_owner_name && <CopyableDetailRow label="نام صاحب حساب" value={wallet.account_owner_name} valueDir="auto" />}
              {wallet.card_number && (
                <CopyableDetailRow label="شماره کارت" value={formatCardNumber(wallet.card_number)} copyValue={wallet.card_number} />
              )}
              {wallet.account_number && (
                <CopyableDetailRow label="شماره حساب" value={wallet.account_number} copyValue={wallet.account_number} />
              )}
              {wallet.iban && <CopyableDetailRow label="شبا" value={formatIban(wallet.iban)} copyValue={wallet.iban} />}
            </List>
          ) : (
            <div className="flex items-center gap-3 rounded-card bg-panel p-4">
              <Avatar tone="neutral" fallback={<CreditCard />} />
              <Text variant="caption" tone="muted">
                نام صاحب حساب، شماره کارت، حساب یا شبا را اضافه کن تا با یک لمس کپی شود.
              </Text>
            </div>
          )}
        </Section>

        <Section title="تاریخچه تراکنش‌ها">
          {stats.transactions.length > 0 && (
            <div className="space-y-2">
              <TransactionHistorySearchBar value={txSearchQuery} onChange={setTxSearchQuery} />
              <TransactionHistoryTypeFilter value={txTypeFilter} onChange={setTxTypeFilter} />
            </div>
          )}
          {stats.transactions.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState
                icon={<WalletIcon />}
                title="هنوز تراکنشی ثبت نشده"
                action={<Button onClick={() => router.push(`/transactions/new?walletId=${wallet.id}`)}>ثبت تراکنش</Button>}
              />
            </div>
          ) : walletHistoryItems.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState compact title={txSearchQuery.trim() ? 'تراکنشی با این جستجو پیدا نشد' : 'تراکنشی با این نوع نیست'} />
            </div>
          ) : (
            <div className="space-y-2">
              {walletHistoryItems.map((item) =>
                item.kind === 'convert' ? (
                  <ConvertTransactionCard
                    key={item.group.operationId}
                    group={item.group}
                    assets={assets}
                    onEdit={() => router.push(`/transactions/${item.group.sell.id}/edit`)}
                    onDelete={() => void deleteConvert(item.group)}
                  />
                ) : (
                  <TxRow
                    key={item.tx.id}
                    tx={item.tx}
                    wallet={wallet}
                    wallets={wallets}
                    persons={persons}
                    assets={assets}
                    categories={categories}
                    onEdit={() => router.push(`/transactions/${item.tx.id}/edit`)}
                    onDelete={() => void deleteTx(item.tx.id)}
                  />
                )
              )}
            </div>
          )}
        </Section>
      </div>

      <WalletPaymentDetailsSheet open={paymentSheetOpen} onClose={() => setPaymentSheetOpen(false)} wallet={wallet} onSaved={updateWallet} />

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-(--ds-max-width) gap-2 bg-canvas/90 px-(--ds-gutter) pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur-md">
        <Button variant="soft" size="lg" startIcon={<ArrowLeftRight />} onClick={() => router.push(`/transactions/new?walletId=${wallet.id}&type=TRANSFER`)}>
          انتقال
        </Button>
        <Button size="lg" className="min-w-0 flex-1" startIcon={<Plus />} onClick={() => router.push(`/transactions/new?walletId=${wallet.id}`)}>
          تراکنش جدید
        </Button>
      </div>
    </div>
  );
}

function TxRow({
  tx,
  wallet,
  wallets,
  persons,
  assets,
  categories,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  wallet: Wallet;
  wallets: Wallet[];
  persons: Person[];
  assets: Asset[];
  categories: { id: string; name: string }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isSource = tx.source_wallet_id === wallet.id;
  const amount = isSource ? Number(tx.source_amount) : Number(tx.target_amount);
  const isIn = !isSource;
  const counterparty = describeCounterparty(tx, wallet, wallets, persons, assets, categories);
  return (
    <List>
      <ListRow
        chevron={false}
        leading={
          <Avatar
            tone={tx.type === 'TRANSFER' ? 'neutral' : isIn ? 'positive' : 'negative'}
            fallback={tx.type === 'TRANSFER' ? <ArrowLeftRight /> : isIn ? <ArrowDownLeft /> : <ArrowUpLeft />}
          />
        }
        title={[TYPE_LABELS[tx.type], counterparty].filter(Boolean).join(' · ')}
        subtitle={[toPersianDigits(tx.date_string), tx.note].filter(Boolean).join(' · ')}
        trailing={
          <span className="flex flex-col items-end gap-0.5">
            <NativeAmount value={isIn ? Math.abs(amount) : -Math.abs(amount)} currency={wallet.currency} size="sm" signed={isIn} tone="auto" compact />
            <span className="flex">
              <IconButton size="sm" aria-label="ویرایش" icon={<Pencil />} onClick={onEdit} />
              <IconButton size="sm" aria-label="حذف" icon={<Trash2 />} onClick={onDelete} />
            </span>
          </span>
        }
      />
    </List>
  );
}

function describeCounterparty(
  tx: Transaction,
  wallet: Wallet,
  wallets: Wallet[],
  persons: Person[],
  assets: Asset[],
  categories: { id: string; name: string }[]
): string {
  // Pick the side opposite to `wallet`.
  const isSource = tx.source_wallet_id === wallet.id;
  const otherWalletId = isSource ? tx.target_wallet_id : tx.source_wallet_id;
  const otherAssetId = isSource ? tx.target_asset_id : tx.source_asset_id;
  const otherPersonId = isSource ? tx.target_person_id : tx.source_person_id;

  if (otherWalletId) {
    const w = wallets.find((x) => x.id === otherWalletId);
    return w ? w.name : 'کیف پول حذف‌شده';
  }
  if (otherAssetId) {
    const a = assets.find((x) => x.id === otherAssetId);
    return a ? a.name : 'دارایی حذف‌شده';
  }
  if (otherPersonId) {
    return persons.find((x) => x.id === otherPersonId)?.name ?? 'شخص';
  }
  // INCOME / EXPENSE have no endpoint counterparty; show category title.
  if ((tx.type === 'INCOME' || tx.type === 'EXPENSE') && tx.category_id) {
    const c = categories.find((x) => x.id === tx.category_id);
    if (c) return c.name;
  }
  if (tx.type === 'INCOME') return 'درآمد بدون دسته';
  if (tx.type === 'EXPENSE') return 'هزینه بدون دسته';
  return '';
}
