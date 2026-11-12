'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, EmptyState, IconButton, List, ListRow, Section, Text, TopBar } from '@/design-system';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpLeft, Pencil, Trash2 } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { supabase } from '@/shared/lib/supabase/client';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import type { Transaction, TransactionType } from '@/shared/types/domain';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import { personCurrency } from '@/shared/utils/person-currency';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import { PersonAmount } from './PersonAmount';
import {
  buildPersonSettleTransactionUrl,
  pickDefaultSettleWallet,
} from '@/features/persons/utils/person-settle-prefill';

const TYPE_LABELS: Record<TransactionType, string> = {
  BUY: 'خرید',
  SELL: 'فروش',
  TRANSFER: 'انتقال',
  INCOME: 'درآمد',
  EXPENSE: 'هزینه',
};

export interface PersonDetailViewProps {
  personId: string;
}

export function PersonDetailView({ personId }: PersonDetailViewProps) {
  const router = useRouter();
  const goBack = useSafeBack('/deadlines/persons');
  const toast = useToast();
  const { confirm } = useConfirm();
  const { persons, wallets, assets, categories, transactions, setTransactions } = useData();

  const person = persons.find((p) => p.id === personId);
  const currency = personCurrency(person);
  const defaultWallet = useMemo(() => pickDefaultSettleWallet(wallets, currency), [wallets, currency]);

  const balance = useMemo(
    () => (person ? calculatePersonBalance(person, transactions) : 0),
    [person, transactions]
  );

  const personTxs = useMemo(() => {
    if (!person) return [];
    return transactions
      .filter(
        (tx) => tx.source_person_id === person.id || tx.target_person_id === person.id
      )
      .sort((a, b) => b.date_string.localeCompare(a.date_string));
  }, [person, transactions]);

  if (!person) {
    return (
      <div className="min-h-full bg-canvas">
        <TopBar onBack={() => goBack()} title="شخص" />
        <EmptyState title="شخص پیدا نشد" />
      </div>
    );
  }

  // Below one cent / half a toman counts as settled.
  const eps = currency === 'IRT' ? 0.5 : 0.005;
  const status = balance > eps ? 'به تو بدهکار است' : balance < -eps ? 'تو به او بدهکاری' : 'تسویه است';

  const openSettle = () => {
    if (!defaultWallet) {
      toast.error('برای تسویه ابتدا یک کیف پول فعال بساز.');
      return;
    }
    const url = buildPersonSettleTransactionUrl({
      personId: person.id,
      walletId: defaultWallet.id,
      balance,
    });
    if (!url) {
      toast.info('این شخص تسویه است.');
      return;
    }
    router.push(url);
  };

  const deleteTx = async (id: string) => {
    if (!(await confirm({ message: 'این تراکنش حذف شود؟', variant: 'danger', confirmLabel: 'حذف' }))) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      toast.success('تراکنش حذف شد.');
    } catch (error) {
      console.error(error);
      toast.error('خطا در حذف تراکنش.');
    }
  };

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title={person.name} />
      <div className="space-y-5 px-(--ds-gutter)">
        <section aria-label="مانده حساب" className="flex flex-col items-center gap-2 rounded-card bg-panel p-5 text-center">
          <Avatar size="lg" name={person.name} tone="rose" />
          <Text variant="caption" tone="subtle">
            مانده حساب
          </Text>
          <PersonAmount currency={currency} value={Math.abs(balance)} size="lg" tone={balance > eps ? 'positive' : balance < -eps ? 'negative' : 'default'} />
          {currency !== 'IRT' && (
            <Text variant="caption" tone="subtle">
              حساب به {CURRENCY_META[currency].label}
            </Text>
          )}
          <Text variant="callout" tone="muted">
            {status}
          </Text>
          {Math.abs(balance) > eps && (
            <Button onClick={openSettle} className="mt-1">
              {balance > 0 ? 'دریافت تسویه' : 'پرداخت تسویه'}
            </Button>
          )}
        </section>

        <Section title="تراکنش‌ها">
          {personTxs.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState icon={<ArrowLeftRight />} title="تراکنشی با این شخص نیست" description="در ثبت تراکنش، این شخص را در مبدأ یا مقصد انتخاب کن." />
            </div>
          ) : (
            <List>
              {personTxs.map((tx) => {
                const isOut = tx.source_person_id === person.id;
                const amount = isOut ? Number(tx.source_amount) : Number(tx.target_amount);
                return (
                  <ListRow
                    key={tx.id}
                    chevron={false}
                    leading={<Avatar tone={isOut ? 'rose' : 'mint'} fallback={tx.type === 'TRANSFER' ? <ArrowLeftRight /> : isOut ? <ArrowUpLeft /> : <ArrowDownLeft />} />}
                    title={`${TYPE_LABELS[tx.type]} · ${describePersonCounterparty(tx, person.id, wallets, assets, categories)}`}
                    subtitle={[tx.date_string, tx.note].filter(Boolean).join(' · ')}
                    trailing={
                      <span className="flex flex-col items-end gap-1">
                        <PersonAmount currency={currency} value={isOut ? -Math.abs(amount) : Math.abs(amount)} size="sm" tone="auto" signed={!isOut} compact />
                        <span className="flex">
                          <IconButton size="sm" aria-label="ویرایش" icon={<Pencil />} onClick={() => router.push(`/transactions/${tx.id}/edit`)} />
                          <IconButton size="sm" aria-label="حذف" icon={<Trash2 />} onClick={() => void deleteTx(tx.id)} />
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </List>
          )}
        </Section>
      </div>
    </div>
  );
}

function describePersonCounterparty(
  tx: Transaction,
  personId: string,
  wallets: { id: string; name: string }[],
  assets: { id: string; name: string }[],
  categories: { id: string; name: string }[]
): string {
  const otherSide = tx.source_person_id === personId ? 'target' : 'source';
  if (otherSide === 'target') {
    if (tx.target_wallet_id) {
      return wallets.find((w) => w.id === tx.target_wallet_id)?.name ?? 'کیف پول';
    }
    if (tx.target_asset_id) {
      return assets.find((a) => a.id === tx.target_asset_id)?.name ?? 'دارایی';
    }
    if (tx.target_person_id) {
      return 'شخص دیگر';
    }
  } else {
    if (tx.source_wallet_id) {
      return wallets.find((w) => w.id === tx.source_wallet_id)?.name ?? 'کیف پول';
    }
    if (tx.source_asset_id) {
      return assets.find((a) => a.id === tx.source_asset_id)?.name ?? 'دارایی';
    }
    if (tx.source_person_id) {
      return 'شخص دیگر';
    }
  }
  if (tx.category_id) {
    return categories.find((c) => c.id === tx.category_id)?.name ?? '';
  }
  return '—';
}
