'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, PiggyBank, Plus, Trash2, X } from 'lucide-react';
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

  return (
    <section className="bg-[#1A1B26] rounded-2xl border border-white/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PiggyBank size={16} className="text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">قلک‌ها</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              تخصیص مجازی داخل این کیف — تراکنش جدا ثبت نمی‌شود
            </p>
          </div>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 shrink-0"
          >
            <Plus size={14} />
            جدید
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white/3 rounded-xl p-2.5">
          <p className="text-slate-500">تخصیص‌شده</p>
          <p className="text-slate-200 mt-1" dir="ltr">
            {meta.symbol} {formatCurrencyAmount(allocated, wallet.currency as Currency)}
          </p>
        </div>
        <div className="bg-white/3 rounded-xl p-2.5">
          <p className="text-slate-500">آزاد</p>
          <p className="text-slate-200 mt-1" dir="ltr">
            {meta.symbol} {formatCurrencyAmount(freeBalance, wallet.currency as Currency)}
          </p>
        </div>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="bg-white/3 border border-white/5 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{form.editingId ? 'ویرایش قلک' : 'قلک جدید'}</p>
            <button type="button" onClick={resetForm} className="text-slate-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="نام (مثلا: سفر، اضطراری)"
            className="w-full bg-[#222436] border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none focus:border-emerald-500"
            maxLength={64}
            required
          />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, color }))}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                {form.color === color && <Check size={12} className="text-white/90" />}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">تخصیص فعلی</label>
              <FormattedNumberInput
                value={form.currentAmount}
                onValueChange={(value) => setForm((prev) => ({ ...prev, currentAmount: value }))}
                className="w-full bg-[#222436] border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none text-left"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">هدف (اختیاری)</label>
              <FormattedNumberInput
                value={form.targetAmount}
                onValueChange={(value) => setForm((prev) => ({ ...prev, targetAmount: value }))}
                className="w-full bg-[#222436] border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none text-left"
                dir="ltr"
                placeholder="—"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'در حال ذخیره...' : form.editingId ? 'ذخیره' : 'افزودن قلک'}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-center text-slate-500 text-xs py-4 animate-pulse">در حال دریافت...</p>
      ) : pots.length === 0 ? (
        <p className="text-center text-slate-500 text-xs py-4">
          هنوز قلکی نساخته‌ای. برای بودجه‌بندی مجازی داخل همین کیف، یک قلک بساز.
        </p>
      ) : (
        <div className="space-y-3">
          {pots.map((pot) => {
            const progress = potProgressPercent(pot);
            const width = progress != null ? Math.min(Math.max(progress, 0), 100) : 0;
            return (
              <div
                key={pot.id}
                className="bg-white/3 border border-white/5 rounded-xl p-3 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: pot.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100 truncate">{pot.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5" dir="ltr">
                        {meta.symbol}{' '}
                        {formatCurrencyAmount(pot.current_amount, wallet.currency as Currency)}
                        {pot.target_amount != null && (
                          <>
                            {' '}
                            / {formatCurrencyAmount(pot.target_amount, wallet.currency as Currency)}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => openEdit(pot)}
                      className="text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleArchive(pot)}
                      className="p-1.5 rounded-lg text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                      aria-label="حذف"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {progress != null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>پیشرفت هدف</span>
                      <span>{toPersianDigits(Math.round(progress))}٪</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="absolute inset-y-0 right-0 rounded-full bg-emerald-500 transition-[width]"
                        style={{ width: `${width > 0 ? Math.max(width, 4) : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void nudgeAllocation(pot, -Math.max(walletBalance * 0.05, 1))}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 disabled:opacity-50"
                  >
                    −۵٪
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || freeBalance <= 0}
                    onClick={() => void nudgeAllocation(pot, Math.min(freeBalance, Math.max(walletBalance * 0.05, 1)))}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-xs text-emerald-300 disabled:opacity-50"
                  >
                    +۵٪
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
