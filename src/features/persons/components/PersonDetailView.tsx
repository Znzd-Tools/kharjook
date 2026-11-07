'use client';

import { IconBadge, ListGroup, ListRow, Money, PageHeader, Section } from '@/shared/components/ui';
import { formatJalaaliHuman, parseJalaali } from '@/shared/utils/jalali';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  HandCoins,
  UserRound,
} from 'lucide-react';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { EmptyState } from '@/shared/components/EmptyState';
import type { Transaction, TransactionType } from '@/shared/types/domain';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
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
  const toast = useToast();
  const { persons, wallets, assets, categories, transactions } = useData();

  const person = persons.find((p) => p.id === personId);
  const defaultWallet = useMemo(() => pickDefaultSettleWallet(wallets), [wallets]);

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
      <div className="bg-surface-inset min-h-full flex items-center justify-center p-6">
        <p className="text-zinc-500 text-sm">شخص پیدا نشد.</p>
      </div>
    );
  }

  const status = balance > 0 ? 'بدهکار' : balance < 0 ? 'بستانکار' : 'تسویه';
  const tone =
    balance > 0 ? 'text-amber-300' : balance < 0 ? 'text-cyan-300' : 'text-zinc-400';

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


  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title={person.name} subtitle="حساب شخص" />

      <div className="px-4 pt-5 space-y-7">
        <section className="px-1">
          <div className="flex items-center gap-3">
            <IconBadge color="#22d3ee">
              <UserRound size={18} strokeWidth={1.9} />
            </IconBadge>
            <p className={`text-xs ${tone}`}>{status}</p>
          </div>
          <p className="mt-4 text-[2.25rem] leading-tight font-semibold tracking-tight text-zinc-50">
            <Money className={balance === 0 ? '' : tone}>
              {Math.abs(balance).toLocaleString('en-US', { maximumFractionDigits: 6 })}
            </Money>
          </p>
          {balance !== 0 && (
            <button
              type="button"
              onClick={openSettle}
              className="mt-5 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-50 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              <HandCoins size={17} />
              {balance > 0 ? 'دریافت تسویه' : 'پرداخت تسویه'}
            </button>
          )}
        </section>

        <Section title="تاریخچه">
          {personTxs.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight size={22} />}
              title="تراکنشی با این شخص نیست."
              description="موقع ثبت تراکنش، این شخص را در مبدأ یا مقصد انتخاب کن."
            />
          ) : (
            <ListGroup>
              {personTxs.map((tx) => (
                <PersonTxRow
                  key={tx.id}
                  tx={tx}
                  personId={person.id}
                  wallets={wallets}
                  assets={assets}
                  categories={categories}
                  href={`/transactions/${tx.id}/edit`}
                />
              ))}
            </ListGroup>
          )}
        </Section>
      </div>
    </div>
  );
}

function PersonTxRow({
  tx,
  personId,
  wallets,
  assets,
  categories,
  href,
}: {
  tx: Transaction;
  personId: string;
  wallets: { id: string; name: string }[];
  assets: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  href: string;
}) {
  const isOut = tx.source_person_id === personId;
  const amount = isOut ? Number(tx.source_amount) : Number(tx.target_amount);
  const Icon = tx.type === 'TRANSFER' ? ArrowLeftRight : isOut ? ArrowUpRight : ArrowDownRight;
  const counterparty = describePersonCounterparty(tx, personId, wallets, assets, categories);
  const parsed = parseJalaali(tx.date_string);
  return (
    <ListRow
      href={href}
      leading={
        <IconBadge color={isOut ? '#fb7185' : '#34d399'}>
          <Icon size={17} strokeWidth={1.9} />
        </IconBadge>
      }
      title={tx.note?.trim() || TYPE_LABELS[tx.type]}
      subtitle={[counterparty, parsed ? formatJalaaliHuman(parsed) : tx.date_string].filter(Boolean).join(' · ')}
      trailing={
        <Money tone={isOut ? 'negative' : 'positive'}>
          {isOut ? '−' : '+'}
          {Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 6 })}
        </Money>
      }
    />
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
