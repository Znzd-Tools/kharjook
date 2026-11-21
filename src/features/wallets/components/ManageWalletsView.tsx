'use client';

import { useState } from 'react';
import { AmountField, Avatar, Button, EmptyState, Field, IconButton, Input, ListRow, Section, SegmentedControl, Text, TopBar, toast, useConfirm } from '@/design-system';
import { Pencil, Trash2 as Archive, Wallet as WalletIcon } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { NativeAmount } from './NativeAmount';
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
import { IconPicker } from '@/shared/components/IconPicker';
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
  const confirm = useConfirm();
  const goBack = useSafeBack('/wallets');
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

  if (!user) return null;

  const resetForm = () => setForm(emptyForm);

  const handleEdit = (w: Wallet) => {
    setForm({
      editingId: w.id,
      name: w.name,
      currency: w.currency,
      initialBalance: String(w.initial_balance ?? ''),
      iconUrl: w.icon_url ?? null,
    });
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
        title: `«${w.name}» بایگانی شود؟`,
        description: 'دیگر در فهرست‌ها دیده نمی‌شود. تراکنش‌های قبلی دست‌نخورده می‌مانند.',
        tone: 'danger',
        confirmLabel: 'بایگانی',
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

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={goBack} title="کیف پول‌ها" />

      <div className="space-y-5 px-(--ds-gutter)">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-card bg-panel p-4">
          <div className="flex items-center justify-between">
            <Text variant="callout" weight="semibold">
              {form.editingId ? 'ویرایش کیف پول' : 'کیف پول جدید'}
            </Text>
            {form.editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                انصراف
              </Button>
            )}
          </div>

          <IconPicker
            value={form.iconUrl}
            onChange={(url) => setForm({ ...form, iconUrl: url })}
            userId={user.id}
            folder="wallets"
            fallback={<WalletIcon className="size-6 text-accent-ink" />}
            label="آیکون (اختیاری)"
          />

          <Field label="نام">
            <Input
              placeholder="مثلاً ملی، صرافی، نقد دلاری"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={64}
            />
          </Field>

          <Field label="ارز" hint={form.editingId ? 'ارز بعد از ساخت قابل تغییر نیست.' : undefined}>
            <SegmentedControl<Currency>
              aria-label="ارز"
              size="sm"
              value={form.currency}
              disabled={form.editingId !== null}
              onValueChange={(c) => setForm({ ...form, currency: c })}
              options={CURRENCY_ORDER.map((c) => ({ value: c, label: `${CURRENCY_META[c].symbol} ${c}` }))}
            />
          </Field>

          <Field label={`موجودی اولیه (${CURRENCY_META[form.currency].label})`}>
            <AmountField
              aria-label="موجودی اولیه"
              value={form.initialBalance}
              onValueChange={(canonical) => setForm({ ...form, initialBalance: canonical })}
              currency={form.currency === 'USD' ? 'USD' : 'TOMAN'}
              unitLabel={form.currency === 'TRY' || form.currency === 'EUR' ? CURRENCY_META[form.currency].label : undefined}
            />
          </Field>

          <Button type="submit" fullWidth loading={isSubmitting} variant={form.editingId ? 'primary' : 'secondary'}>
            {form.editingId ? 'ثبت تغییرات' : 'افزودن کیف پول'}
          </Button>
        </form>

        <Section title="کیف پول‌ها" description="برای جابه‌جایی، دستگیره کنار هر نام را بکش.">
          {wallets.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState compact icon={<WalletIcon />} title="هنوز کیف پولی نساخته‌ای" />
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={wallets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {wallets.map((w) => (
                    <SortableWalletRow
                      key={w.id}
                      wallet={w}
                      onEdit={() => handleEdit(w)}
                      onArchive={() => void handleArchive(w)}
                      archiving={archivingId === w.id}
                      pending={pendingWalletIds.has(w.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Section>
      </div>
    </div>
  );
}

function SortableWalletRow({
  wallet,
  onEdit,
  onArchive,
  archiving,
  pending,
}: {
  wallet: Wallet;
  onEdit: () => void;
  onArchive: () => void;
  archiving: boolean;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: wallet.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-card bg-panel ${isDragging ? 'opacity-70 ring-1 ring-accent' : ''} ${pending ? 'opacity-60' : ''}`}
    >
      <ListRow
        asListItem={false}
        chevron={false}
        leading={
          <span className="flex items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              style={{ touchAction: 'none' }}
              className="ds-focus cursor-grab rounded px-1 text-fg-subtle active:cursor-grabbing"
              aria-label={`جابجایی ${wallet.name}`}
            >
              ⋮⋮
            </button>
            <Avatar src={wallet.icon_url} name={wallet.name} fallback={<WalletIcon />} tone="lilac" />
          </span>
        }
        title={wallet.name}
        subtitle={
          <span className="inline-flex items-center gap-1">
            اولیه <NativeAmount value={wallet.initial_balance} currency={wallet.currency} size="xs" compact />
          </span>
        }
        trailing={
          <span className="flex">
            <IconButton size="sm" aria-label={`ویرایش ${wallet.name}`} icon={<Pencil />} disabled={pending} onClick={onEdit} />
            <IconButton size="sm" aria-label={`بایگانی ${wallet.name}`} icon={<Archive />} disabled={archiving || pending} onClick={onArchive} />
          </span>
        }
      />
    </div>
  );
}
