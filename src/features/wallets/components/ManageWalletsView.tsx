'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  ActionSheet,
  Field,
  HeaderAction,
  PageHeader,
  PrimaryButton,
  SortableListRow,
  fieldInputClass,
} from '@/shared/components/ui';
import { useState } from 'react';
import { Archive, Edit3, Wallet as WalletIcon } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { IconPicker } from '@/shared/components/IconPicker';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { formatCurrencyAmount } from '@/shared/utils/format-currency';
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import { haptic } from '@/shared/utils/haptics';
import { supabase } from '@/shared/lib/supabase/client';
import { deleteEntityIcon } from '@/shared/utils/entity-icon-storage';
import type { Currency, Wallet } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import {
  CURRENCY_META,
  CURRENCY_ORDER,
} from '@/features/wallets/constants/currency-meta';

type FormState = {
  editingId: string | null;
  name: string;
  currency: Currency;
  initialBalance: string;
  iconUrl: string | null;
};

const emptyForm: FormState = {
  editingId: null,
  name: '',
  currency: 'IRT',
  initialBalance: '',
  iconUrl: null,
};

export function ManageWalletsView() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { wallets, setWallets } = useData();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [pendingWalletIds, setPendingWalletIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionWalletId, setActionWalletId] = useState<string | null>(null);

  if (!user) return null;

  const resetForm = () => {
    setForm(emptyForm);
    setSheetOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const handleEdit = (w: Wallet) => {
    setForm({
      editingId: w.id,
      name: w.name,
      currency: w.currency,
      initialBalance: String(w.initial_balance ?? ''),
      iconUrl: w.icon_url ?? null,
    });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const initial = Number(form.initialBalance || '0');
    if (!name || Number.isNaN(initial)) return;

    const execute = async () => {
      if (form.editingId) {
        const editingId = form.editingId;
        const snapshot = wallets;
        const patch = {
          name,
          initial_balance: initial,
          icon_url: form.iconUrl,
        };
        // Currency is intentionally immutable post-creation: changing it would
        // silently alter the meaning of every transaction touching this wallet.
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingWalletIds((prev) => new Set(prev).add(editingId));
            setWallets((prev) =>
              prev.map((w) =>
                w.id === editingId ? { ...w, ...patch } : w
              )
            );
          },
          rollback: (prev) => {
            setPendingWalletIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setWallets(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('wallets')
              .update(patch)
              .eq('id', editingId)
              .select()
              .single();
            if (error) throw error;
            return data as Wallet;
          },
          onSuccess: (saved) => {
            setPendingWalletIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setWallets((prev) =>
              prev.map((w) => (w.id === editingId ? saved : w))
            );
          },
        });
      } else {
        const nextOrder =
          wallets.reduce(
            (max, w) => Math.max(max, Number.isFinite(w.order_index) ? Number(w.order_index) : -1),
            -1
          ) + 1;
        const snapshot = wallets;
        const tempId = `temp-wallet-${crypto.randomUUID()}`;
        const optimisticWallet: Wallet = {
          id: tempId,
          user_id: user.id,
          name,
          currency: form.currency,
          initial_balance: initial,
          icon_url: form.iconUrl,
          archived_at: null,
          order_index: nextOrder,
          created_at: new Date().toISOString(),
        };
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingWalletIds((prev) => new Set(prev).add(tempId));
            setWallets((prev) => [...prev, optimisticWallet]);
          },
          rollback: (prev) => {
            setPendingWalletIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setWallets(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('wallets')
              .insert([
                {
                  user_id: user.id,
                  name,
                  currency: form.currency,
                  initial_balance: initial,
                  icon_url: form.iconUrl,
                  order_index: nextOrder,
                },
              ])
              .select()
              .single();
            if (error) throw error;
            return data as Wallet;
          },
          onSuccess: (saved) => {
            setPendingWalletIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setWallets((prev) =>
              prev.map((w) => (w.id === tempId ? saved : w))
            );
          },
        });
      }
      resetForm();
    };

    setIsSubmitting(true);
    try {
      await execute();
    } catch (err) {
      console.error(err);
      toast.error('خطا در ثبت کیف پول.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const persistWalletOrder = async (ordered: Wallet[]) => {
    const normalized = ordered.map((w, i) => ({ ...w, order_index: i }));
    const updates = normalized.map((w) =>
      supabase.from('wallets').update({ order_index: w.order_index }).eq('id', w.id)
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error)?.error;
    if (err) {
      console.error(err);
      toast.error('ذخیره ترتیب کیف پول‌ها ناموفق بود.');
      const { data } = await supabase
        .from('wallets')
        .select('*')
        .is('archived_at', null)
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (data) setWallets(data as Wallet[]);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    haptic('selection');
    setWallets((prev) => {
      const fromIndex = prev.findIndex((w) => w.id === active.id);
      const toIndex = prev.findIndex((w) => w.id === over.id);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const reordered = arrayMove(prev, fromIndex, toIndex);
      void persistWalletOrder(reordered);
      return reordered;
    });
  };

  const onDragStart = () => {
    haptic('light');
  };

  const handleArchive = async (w: Wallet) => {
    if (
      !(await confirm({
        message: `«${w.name}» بایگانی می‌شود و دیگر در فهرست‌ها نمایش داده نمی‌شود. تراکنش‌های قبلی دست‌نخورده باقی می‌ماند. ادامه می‌دهی؟`,
        variant: 'danger',
        confirmLabel: 'حذف',
      }))
    )
      return;

    const execute = async () => {
      const snapshot = wallets;
      setArchivingId(w.id);
      setPendingWalletIds((prev) => new Set(prev).add(w.id));
      await runOptimisticMutation({
        snapshot,
        applyOptimistic: () => {
          setWallets((prev) => prev.filter((x) => x.id !== w.id));
        },
        rollback: (prev) => {
          setPendingWalletIds((p) => {
            const next = new Set(p);
            next.delete(w.id);
            return next;
          });
          setWallets(prev);
        },
        commit: async () => {
          const { error } = await supabase
            .from('wallets')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', w.id);
          if (error) throw error;
          if (w.icon_url) {
            await deleteEntityIcon(supabase, w.icon_url);
          }
        },
        onSuccess: () => {
          setPendingWalletIds((p) => {
            const next = new Set(p);
            next.delete(w.id);
            return next;
          });
        },
      });
      if (form.editingId === w.id) resetForm();
    };

    try {
      await execute();
    } catch (err) {
      console.error(err);
      toast.error('خطا در بایگانی.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    } finally {
      setPendingWalletIds((p) => {
        const next = new Set(p);
        next.delete(w.id);
        return next;
      });
      setArchivingId(null);
    }
  };

  const actionWallet = wallets.find((w) => w.id === actionWalletId) ?? null;

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title="مدیریت کیف پول‌ها" actions={<HeaderAction label="کیف پول جدید" onClick={openCreate} />} />

      <div className="px-4 pt-5 space-y-3">
        {wallets.length === 0 ? (
          <EmptyState
            icon={<WalletIcon size={22} />}
            title="هنوز کیف پولی نساخته‌ای."
            description="حساب بانکی، کارت یا پول نقد — هر جایی که پول نگه می‌داری."
            actionLabel="ساخت کیف پول"
            onAction={openCreate}
          />
        ) : (
          <>
            <p className="px-1 text-xs text-zinc-500">برای جابجایی، دستگیره را بکش. بایگانی، کیف پول را از لیست‌ها پنهان می‌کند.</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={wallets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface-raised divide-y divide-white/5">
                  {wallets.map((w) => (
                    <SortableWalletRow
                      key={w.id}
                      wallet={w}
                      metaLabel={CURRENCY_META[w.currency]}
                      onOpen={() => handleEdit(w)}
                      onMore={() => setActionWalletId(w.id)}
                      pending={pendingWalletIds.has(w.id) || archivingId === w.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      <ActionSheet
        open={actionWallet !== null}
        onClose={() => setActionWalletId(null)}
        title={actionWallet?.name}
        actions={
          actionWallet
            ? [
                { label: 'ویرایش', icon: <Edit3 size={17} />, onSelect: () => handleEdit(actionWallet) },
                {
                  label: 'بایگانی',
                  icon: <Archive size={17} />,
                  tone: 'danger',
                  disabled: archivingId === actionWallet.id || pendingWalletIds.has(actionWallet.id),
                  onSelect: () => void handleArchive(actionWallet),
                },
              ]
            : []
        }
      />

      <BottomSheet open={sheetOpen} onClose={resetForm} title={form.editingId ? 'ویرایش کیف پول' : 'کیف پول جدید'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <IconPicker
            value={form.iconUrl}
            onChange={(url) => setForm({ ...form, iconUrl: url })}
            userId={user.id}
            folder="wallets"
            fallback={<WalletIcon size={22} className="text-zinc-300" />}
            bgColor="rgba(255,255,255,0.06)"
            label="آیکون (اختیاری)"
          />
          <Field label="نام">
            <input
              type="text"
              placeholder="مثلاً ملت، نوبیتکس، نقد دلاری"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldInputClass}
              required
              maxLength={64}
            />
          </Field>
          <Field label="ارز" hint={form.editingId ? 'ارز پس از ساخت قابل تغییر نیست.' : undefined}>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCY_ORDER.map((c) => {
                const meta = CURRENCY_META[c];
                const selected = form.currency === c;
                const disabled = form.editingId !== null && !selected;
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={disabled}
                    onClick={() => setForm({ ...form, currency: c })}
                    className={`flex h-14 flex-col items-center justify-center rounded-xl border transition-colors ${
                      selected
                        ? 'border-zinc-50 bg-zinc-50 text-zinc-900'
                        : 'border-white/8 text-zinc-300 hover:bg-white/4'
                    } ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
                  >
                    <span className="text-base leading-none" dir="ltr">{meta.symbol}</span>
                    <span className="mt-1 text-[11px] opacity-70">{c}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={`موجودی اولیه (${CURRENCY_META[form.currency].label})`}>
            <FormattedNumberInput
              value={form.initialBalance}
              onValueChange={(canonical) => setForm({ ...form, initialBalance: canonical })}
              className={`${fieldInputClass} text-left text-lg font-semibold`}
              dir="ltr"
              placeholder="0"
            />
          </Field>
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ثبت...' : form.editingId ? 'ذخیره تغییرات' : 'افزودن کیف پول'}
          </PrimaryButton>
        </form>
      </BottomSheet>
    </div>
  );
}

function SortableWalletRow({
  wallet,
  metaLabel,
  onOpen,
  onMore,
  pending,
}: {
  wallet: Wallet;
  metaLabel: { symbol: string; decimals: number };
  onOpen: () => void;
  onMore: () => void;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: wallet.id });
  return (
    <SortableListRow
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: pending ? 0.5 : undefined }}
      handleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      onOpen={onOpen}
      onMore={onMore}
      leading={
        <EntityIcon
          iconUrl={wallet.icon_url}
          fallback={<WalletIcon size={17} />}
          bgColor="rgba(255,255,255,0.06)"
          color="#d4d4d8"
          className="h-10 w-10 shrink-0 rounded-full!"
        />
      }
      title={wallet.name}
      subtitle={
        <span dir="ltr">
          {wallet.currency} · موجودی اولیه {metaLabel.symbol}
          {formatCurrencyAmount(wallet.initial_balance, wallet.currency)}
        </span>
      }
    />
  );
}
