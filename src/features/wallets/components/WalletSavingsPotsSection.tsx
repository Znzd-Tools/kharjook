'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AmountField, Button, EmptyState, Field, IconButton, Input, List, ListRow, ProgressBar, Section, Sheet, Skeleton, StatTile, Text, toast, useConfirm } from '@/design-system';
import { Check, Pencil, Plus, Trash2 } from '@/design-system/icons';
import { NativeAmount } from './NativeAmount';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth } from '@/features/portfolio/PortfolioProvider';
import { CATEGORY_COLORS } from '@/features/categories/constants/category-colors';
import type { Wallet, WalletSavingsPot } from '@/shared/types/domain';
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
  const confirm = useConfirm();
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
  }, [wallet.id]);

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
    if (!(await confirm({ title: `قلک «${pot.name}» حذف شود؟`, confirmLabel: 'حذف', tone: 'danger' }))) return;
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

  const cur = wallet.currency;
  const amountProps = {
    currency: cur === 'USD' ? ('USD' as const) : ('TOMAN' as const),
    unitLabel: cur === 'TRY' || cur === 'EUR' ? meta.label : undefined,
  };
  const step = Math.max(walletBalance * 0.05, 1);

  return (
    <Section
      title="قلک‌ها"
      description="تخصیص مجازی داخل همین کیف؛ تراکنشی ثبت نمی‌شود."
      action={
        <Button variant="link" size="sm" startIcon={<Plus />} onClick={openCreate}>
          قلک جدید
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="تخصیص‌شده" value={<NativeAmount value={allocated} currency={cur} size="sm" compact />} />
        <StatTile label="آزاد" value={<NativeAmount value={freeBalance} currency={cur} size="sm" compact />} />
      </div>

      {allocated > walletBalance + 1e-6 && (
        <Text variant="caption" tone="warning">
          جمع قلک‌ها از موجودی کیف بیشتر است. یکی را کم کن.
        </Text>
      )}

      {isLoading ? (
        <Skeleton className="h-16 rounded-card" />
      ) : pots.length === 0 ? (
        <div className="rounded-card bg-panel">
          <EmptyState compact title="هنوز قلکی نیست" description="برای بودجه‌بندی مجازی داخل همین کیف، یک قلک بساز." />
        </div>
      ) : (
        <List>
          {pots.map((pot) => {
            const progress = potProgressPercent(pot);
            return (
              <ListRow
                key={pot.id}
                chevron={false}
                leading={<span className="size-3 rounded-full" style={{ backgroundColor: pot.color }} aria-hidden />}
                title={pot.name}
                subtitle={
                  <span className="flex flex-col gap-1.5">
                    <span className="inline-flex items-center gap-1">
                      <NativeAmount value={Number(pot.current_amount)} currency={cur} size="xs" compact />
                      {pot.target_amount != null && (
                        <>
                          از <NativeAmount value={Number(pot.target_amount)} currency={cur} size="xs" compact />
                        </>
                      )}
                    </span>
                    {progress != null && (
                      <ProgressBar value={Math.max(0, progress)} max={100} tone="positive" valueLabel={`${toPersianDigits(Math.round(progress))}٪`} />
                    )}
                    <span className="flex gap-2">
                      <Button size="sm" variant="secondary" disabled={isSubmitting} onClick={() => void nudgeAllocation(pot, -step)}>
                        −۵٪
                      </Button>
                      <Button
                        size="sm"
                        variant="soft"
                        disabled={isSubmitting || freeBalance <= 0}
                        onClick={() => void nudgeAllocation(pot, Math.min(freeBalance, step))}
                      >
                        +۵٪
                      </Button>
                    </span>
                  </span>
                }
                trailing={
                  <span className="flex">
                    <IconButton size="sm" aria-label={`ویرایش ${pot.name}`} icon={<Pencil />} disabled={isSubmitting} onClick={() => openEdit(pot)} />
                    <IconButton size="sm" aria-label={`حذف ${pot.name}`} icon={<Trash2 />} disabled={isSubmitting} onClick={() => void handleArchive(pot)} />
                  </span>
                }
              />
            );
          })}
        </List>
      )}

      <Sheet
        open={formOpen}
        onOpenChange={(o) => !o && resetForm()}
        title={form.editingId ? 'ویرایش قلک' : 'قلک جدید'}
        footer={
          <Button type="submit" form="pot-form" size="lg" fullWidth loading={isSubmitting}>
            {form.editingId ? 'ذخیره' : 'افزودن قلک'}
          </Button>
        }
      >
        <form id="pot-form" onSubmit={handleSubmit} className="space-y-4">
          <Field label="نام">
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="مثلاً سفر، اضطراری"
              maxLength={64}
              required
            />
          </Field>
          <Field label="رنگ">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="رنگ">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={form.color === color}
                  aria-label={color}
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  className="ds-focus flex size-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: color }}
                >
                  {form.color === color && <Check className="size-4 text-fg-on-accent" />}
                </button>
              ))}
            </div>
          </Field>
          <Field label="تخصیص فعلی">
            <AmountField value={form.currentAmount} onValueChange={(value) => setForm((prev) => ({ ...prev, currentAmount: value }))} {...amountProps} />
          </Field>
          <Field label="هدف (اختیاری)">
            <AmountField value={form.targetAmount} onValueChange={(value) => setForm((prev) => ({ ...prev, targetAmount: value }))} {...amountProps} />
          </Field>
        </form>
      </Sheet>
    </Section>
  );
}
