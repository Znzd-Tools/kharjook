'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Edit3,
  HandCoins,
  Trash2,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/shared/lib/supabase/client';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { EmptyState } from '@/shared/components/EmptyState';
import type { Transaction, TransactionType } from '@/shared/types/domain';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import { latinizeDigits } from '@/shared/utils/latinize-digits';
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
  const { persons, wallets, assets, categories, transactions, setTransactions } = useData();

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
      <div className="bg-[#0F1015] min-h-full flex items-center justify-center p-6">
        <p className="text-slate-500 text-sm">شخص پیدا نشد.</p>
      </div>
    );
  }

  const status = balance > 0 ? 'بدهکار' : balance < 0 ? 'بستانکار' : 'تسویه';
  const tone =
    balance > 0 ? 'text-amber-300' : balance < 0 ? 'text-cyan-300' : 'text-slate-400';

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
    const ok = window.confirm('این تراکنش حذف شود؟');
    if (!ok) return;
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
    <div className="bg-[#0F1015] min-h-full pb-24 animate-in slide-in-from-right-8 duration-300">
      <div className="sticky top-0 bg-[#161722]/90 backdrop-blur-md px-6 py-4 flex items-center gap-4 border-b border-white/5 z-20">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 -mr-2 bg-white/5 rounded-full text-slate-300 hover:bg-white/10"
        >
          <ArrowRight size={20} />
        </button>
        <h2 className="text-lg font-bold text-white flex-1 truncate">{person.name}</h2>
      </div>

      <div className="p-6 space-y-6">
        <div className="text-center py-6 bg-linear-to-b from-cyan-500/10 to-transparent rounded-3xl border border-cyan-500/20">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-300 flex items-center justify-center">
              <UserRound size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-2">مانده حساب</p>
          <p className={`text-3xl font-bold ${tone}`} dir="ltr">
            {Math.abs(balance).toLocaleString('en-US', { maximumFractionDigits: 6 })}
          </p>
          <p className={`text-sm mt-2 ${tone}`}>{status}</p>
          {balance !== 0 && (
            <button
              type="button"
              onClick={openSettle}
              className="mt-4 inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              <HandCoins size={16} />
              {balance > 0 ? 'دریافت تسویه' : 'پرداخت تسویه'}
            </button>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400">تراکنش‌ها</h3>
          {personTxs.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight size={24} />}
              title="تراکنشی با این شخص نیست."
              description="از ثبت تراکنش، این شخص را در مبدأ یا مقصد انتخاب کن."
            />
          ) : (
            personTxs.map((tx) => (
              <PersonTxRow
                key={tx.id}
                tx={tx}
                personId={person.id}
                wallets={wallets}
                assets={assets}
                categories={categories}
                onEdit={() => router.push(`/transactions/${tx.id}/edit`)}
                onDelete={() => void deleteTx(tx.id)}
              />
            ))
          )}
        </div>
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
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  personId: string;
  wallets: { id: string; name: string }[];
  assets: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isSource = tx.source_person_id === personId;
  const amount = isSource ? Number(tx.source_amount) : Number(tx.target_amount);
  const isOut = isSource;
  const accent = isOut ? 'bg-rose-500' : 'bg-emerald-500';
  const tone = isOut ? 'text-rose-400' : 'text-emerald-400';
  const Icon = tx.type === 'TRANSFER' ? ArrowLeftRight : isOut ? ArrowUpRight : ArrowDownRight;
  const counterparty = describePersonCounterparty(tx, personId, wallets, assets, categories);

  return (
    <div className="bg-[#1A1B26] p-4 rounded-2xl border border-white/5 flex flex-col gap-3 relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${tone} shrink-0`}
          >
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-slate-200 text-sm font-medium">{TYPE_LABELS[tx.type]}</p>
            <p className="text-slate-500 text-xs mt-0.5 truncate">{counterparty}</p>
          </div>
        </div>
        <div className="text-left shrink-0">
          <p className={`text-sm font-bold ${tone}`} dir="ltr">
            {isOut ? '-' : '+'}
            {Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 6 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{latinizeDigits(tx.date_string)}</p>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-white/5">
        <span className="text-[10px] text-slate-600 truncate" dir="ltr">
          {tx.note || ''}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="text-blue-400/50 hover:text-blue-400 transition-colors p-1.5"
            aria-label="ویرایش"
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-rose-400/50 hover:text-rose-400 transition-colors p-1.5"
            aria-label="حذف"
          >
            <Trash2 size={16} />
          </button>
        </div>
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
