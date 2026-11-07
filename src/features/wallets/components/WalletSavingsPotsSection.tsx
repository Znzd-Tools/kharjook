'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import {
  Card,
  Field,
  ListGroup,
  Money,
  PrimaryButton,
  ProgressBar,
  Section,
  fieldInputClass,
} from '@/shared/components/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, PiggyBank } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { CATEGORY_COLORS } from '@/features/categories/constants/category-colors';
import type { Currency, Wallet, WalletSavingsPot } from '@/shared/types/domain';
import { formatCurrencyAmount } from '@/shared/utils/format-currency';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import {
  canSetPotAmount,
  potProgressPercent,
  sumPotAllocations,
  unallocatedBalance,
} from '@/features/wallets/utils/wallet-savings-pots';
import { toPersianDigits } from '@/shared/utils/format-display-number';

type PotFormState = {
  editingId: string | null;
  name: string;
  color: string;
  targetAmount: string;
  currentAmount: string;
};

const emptyForm = (): PotFormState => ({
  editingId: null,
  name: '',
  color: CATEGORY_COLORS[0],
  targetAmount: '',
  currentAmount: '0',
});

export function WalletSavingsPotsSection({
  wallet,
  walletBalance,
}: {
  wallet: Wallet;
  walletBalance: number;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [pots, setPots] = useState<WalletSavingsPot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PotFormState>(emptyForm);

  const meta = CURRENCY_META[wallet.currency];

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallet_savings_pots')
        .select('*')
        .eq('wallet_id', wallet.id)
        .is('archived_at', null)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPots((data ?? []) as WalletSavingsPot[]);
    } catch (error) {
      console.error(error);
      toast.error('خطا در دریافت قلک‌ها.');
    } finally {
      setIsLoading(false);
    }
  }, [toast, wallet.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allocated = useMemo(() => sumPotAllocations(pots), [pots]);
  const freeBalance = useMemo(
    () => unallocatedBalance(walletBalance, pots),
    [walletBalance, pots]
  );

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (pot: WalletSavingsPot) => {
    setForm({
      editingId: pot.id,
      name: pot.name,
      color: pot.color,
      targetAmount: pot.target_amount != null ? String(pot.target_amount) : '',
      currentAmount: String(pot.current_amount),
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const name = form.name.trim();
    if (!name) {
      toast.error('نام قلک الزامی است.');
      return;
    }

    const currentAmount = Number(form.currentAmount || '0');
    const targetAmount = form.targetAmount.trim() ? Number(form.targetAmount) : null;

    if (!Number.isFinite(currentAmount) || currentAmount < 0) {
      toast.error('مبلغ تخصیص‌یافته نامعتبر است.');
      return;
    }
    if (targetAmount != null && (!Number.isFinite(targetAmount) || targetAmount <= 0)) {
      toast.error('هدف پس‌انداز نامعتبر است.');
      return;
    }

    const potId = form.editingId ?? '__new__';
    if (!canSetPotAmount(pots, potId, currentAmount, walletBalance)) {
      toast.error('جمع تخصیص قلک‌ها از موجودی کیف پول بیشتر است.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (form.editingId) {
        const { error } = await supabase
          .from('wallet_savings_pots')
          .update({
            name,
            color: form.color,
            target_amount: targetAmount,
            current_amount: currentAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', form.editingId);
        if (error) throw error;
        toast.success('قلک ویرایش شد.');
      } else {
        const nextOrder =
          pots.reduce((max, pot) => Math.max(max, pot.order_index ?? 0), -1) + 1;
        const { error } = await supabase.from('wallet_savings_pots').insert({
          user_id: user.id,
          wallet_id: wallet.id,
          name,
          color: form.color,
          target_amount: targetAmount,
          current_amount: currentAmount,
          order_index: nextOrder,
        });
        if (error) throw error;
        toast.success('قلک اضافه شد.');
      }
      resetForm();
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در ذخیره قلک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (pot: WalletSavingsPot) => {
    if (!(await confirm({ message: `قلک «${pot.name}» حذف شود؟`, variant: 'danger', confirmLabel: 'حذف' }))) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('wallet_savings_pots')
        .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', pot.id);
      if (error) throw error;
      toast.success('قلک حذف شد.');
      if (form.editingId === pot.id) resetForm();
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در حذف قلک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nudgeAllocation = async (pot: WalletSavingsPot, delta: number) => {
    const next = Number(pot.current_amount) + delta;
    if (!canSetPotAmount(pots, pot.id, next, walletBalance)) {
      toast.error('موجودی آزاد کافی نیست.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('wallet_savings_pots')
        .update({ current_amount: next, updated_at: new Date().toISOString() })
        .eq('id', pot.id);
      if (error) throw error;
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در به‌روزرسانی تخصیص.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fmt = (v: number) => `${meta.symbol}${formatCurrencyAmount(v, wallet.currency as Currency)}`;
  const nudgeBtn =
    'flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-xs text-zinc-300 hover:bg-white/10 disabled:opacity-40';

  return (
    <Section
      title={
        <span className="flex items-center gap-1.5">
          <PiggyBank size={15} className="text-zinc-400" />
          قلک‌ها
        </span>
      }
      description={
        <>
          آزاد <Money className="text-zinc-300">{fmt(freeBalance)}</Money> · تخصیص‌شده{' '}
          <Money className="text-zinc-300">{fmt(allocated)}</Money>
        </>
      }
      action={{ label: 'قلک جدید', onClick: openCreate }}
    >
      {allocated > walletBalance + 1e-6 && (
        <p className="rounded-xl bg-amber-400/8 px-3 py-2 text-xs text-amber-200">
          جمع قلک‌ها از موجودی فعلی کیف پول بیشتر است. یکی از قلک‌ها را کم کن.
        </p>
      )}

      {isLoading ? (
        <p className="py-4 text-center text-xs text-zinc-500 animate-pulse">در حال دریافت...</p>
      ) : pots.length === 0 ? (
        <Card>
          <p className="text-xs leading-relaxed text-zinc-500">
            قلک یک تخصیص مجازی داخل همین کیف پول است (مثلاً سفر یا اضطراری). تراکنش جدایی ثبت نمی‌شود.
          </p>
        </Card>
      ) : (
        <ListGroup>
          {pots.map((pot) => {
            const progress = potProgressPercent(pot);
            return (
              <div key={pot.id} className="space-y-2.5 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: pot.color }} />
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => openEdit(pot)}
                    className="min-w-0 flex-1 text-right"
                  >
                    <span className="block truncate text-sm font-medium text-zinc-100">{pot.name}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      <Money>{fmt(pot.current_amount)}</Money>
                      {pot.target_amount != null && (
                        <>
                          {' '}
                          از <Money>{fmt(pot.target_amount)}</Money>
                        </>
                      )}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="کم کردن ۵٪"
                      disabled={isSubmitting}
                      onClick={() => void nudgeAllocation(pot, -Math.max(walletBalance * 0.05, 1))}
                      className={nudgeBtn}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-label="افزودن ۵٪"
                      disabled={isSubmitting || freeBalance <= 0}
                      onClick={() =>
                        void nudgeAllocation(pot, Math.min(freeBalance, Math.max(walletBalance * 0.05, 1)))
                      }
                      className={nudgeBtn}
                    >
                      +
                    </button>
                  </div>
                </div>
                {progress != null && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={progress} tone={progress >= 100 ? 'positive' : 'accent'} />
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-500">{toPersianDigits(Math.round(progress))}٪</span>
                  </div>
                )}
              </div>
            );
          })}
        </ListGroup>
      )}

      <BottomSheet open={formOpen} onClose={resetForm} title={form.editingId ? 'ویرایش قلک' : 'قلک جدید'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="نام">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="مثلاً سفر یا اضطراری"
              className={fieldInputClass}
              maxLength={64}
              required
            />
          </Field>
          <Field label="رنگ">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    form.color === color ? 'ring-2 ring-zinc-50 ring-offset-2 ring-offset-surface-overlay' : ''
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {form.color === color && <Check size={13} className="text-white" />}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تخصیص فعلی">
              <FormattedNumberInput
                value={form.currentAmount}
                onValueChange={(value) => setForm((prev) => ({ ...prev, currentAmount: value }))}
                className={`${fieldInputClass} text-left`}
                dir="ltr"
              />
            </Field>
            <Field label="هدف">
              <FormattedNumberInput
                value={form.targetAmount}
                onValueChange={(value) => setForm((prev) => ({ ...prev, targetAmount: value }))}
                className={`${fieldInputClass} text-left`}
                dir="ltr"
                placeholder="اختیاری"
              />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ذخیره...' : form.editingId ? 'ذخیره' : 'افزودن قلک'}
          </PrimaryButton>
          {form.editingId && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                const pot = pots.find((p) => p.id === form.editingId);
                if (pot) void handleArchive(pot);
              }}
              className="w-full text-center text-sm text-rose-400 hover:text-rose-300"
            >
              حذف قلک
            </button>
          )}
        </form>
      </BottomSheet>
    </Section>
  );
}
