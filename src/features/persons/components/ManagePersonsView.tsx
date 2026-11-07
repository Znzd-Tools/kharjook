'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import {
  ActionSheet,
  Field,
  HeaderAction,
  IconBadge,
  Money,
  PageHeader,
  PrimaryButton,
  SortableListRow,
  fieldInputClass,
} from '@/shared/components/ui';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit3, Trash2, UserRound } from 'lucide-react';
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
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { EmptyState } from '@/shared/components/EmptyState';
import type { Person } from '@/shared/types/domain';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';

export function ManagePersonsView() {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { persons, transactions, setPersons } = useData();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionPersonId, setActionPersonId] = useState<string | null>(null);


  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const person of persons) {
      map.set(person.id, calculatePersonBalance(person, transactions));
    }
    return map;
  }, [persons, transactions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  if (!user) return null;

  const reset = () => {
    setEditingId(null);
    setName('');
    setSheetOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setSheetOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('نام شخص الزامی است.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('persons')
          .update({ name: trimmed })
          .eq('id', editingId)
          .select()
          .single();
        if (error) throw error;
        setPersons((prev) =>
          prev.map((p) => (p.id === editingId ? (data as Person) : p))
        );
        toast.success('شخص ویرایش شد.');
      } else {
        const nextOrder =
          persons.reduce(
            (max, p) => Math.max(max, Number.isFinite(p.order_index) ? Number(p.order_index) : -1),
            -1
          ) + 1;
        const { data, error } = await supabase
          .from('persons')
          .insert({ user_id: user.id, name: trimmed, order_index: nextOrder })
          .select()
          .single();
        if (error) throw error;
        setPersons((prev) => [...prev, data as Person]);
        toast.success('شخص ثبت شد.');
      }
      reset();
    } catch (error) {
      console.error(error);
      toast.error('خطا در ثبت شخص.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const persistOrder = async (ordered: Person[]) => {
    const normalized = ordered.map((p, i) => ({ ...p, order_index: i }));
    const results = await Promise.all(
      normalized.map((p) =>
        supabase.from('persons').update({ order_index: p.order_index }).eq('id', p.id)
      )
    );
    const err = results.find((r) => r.error)?.error;
    if (err) {
      console.error(err);
      toast.error('ذخیره ترتیب اشخاص ناموفق بود.');
      const { data } = await supabase
        .from('persons')
        .select('*')
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (data) setPersons(data as Person[]);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPersons((prev) => {
      const fromIndex = prev.findIndex((p) => p.id === active.id);
      const toIndex = prev.findIndex((p) => p.id === over.id);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const reordered = arrayMove(prev, fromIndex, toIndex);
      void persistOrder(reordered);
      return reordered;
    });
  };

  const handleEdit = (person: Person) => {
    setEditingId(person.id);
    setName(person.name);
    setSheetOpen(true);
  };

  const handleDelete = async (person: Person) => {
    const used = transactions.some(
      (tx) => tx.source_person_id === person.id || tx.target_person_id === person.id
    );
    if (used) {
      toast.error('این شخص در تراکنش‌ها استفاده شده و قابل حذف نیست.');
      return;
    }
    if (!(await confirm({ message: 'آیا از حذف این شخص مطمئن هستید؟', variant: 'danger', confirmLabel: 'حذف' }))) return;
    try {
      const { error } = await supabase.from('persons').delete().eq('id', person.id);
      if (error) throw error;
      setPersons((prev) => prev.filter((p) => p.id !== person.id));
      if (editingId === person.id) reset();
      toast.success('شخص حذف شد.');
    } catch (error) {
      console.error(error);
      toast.error('خطا در حذف شخص.');
    }
  };

  const actionPerson = persons.find((p) => p.id === actionPersonId) ?? null;

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader
        title="طلب و بدهی اشخاص"
        actions={<HeaderAction label="شخص جدید" onClick={openCreate} />}
      />

      <div className="px-4 pt-5 space-y-3">
        {persons.length === 0 ? (
          <EmptyState
            icon={<UserRound size={22} />}
            title="هنوز شخصی ثبت نشده."
            description="کسی که به او قرض می‌دهی یا از او قرض می‌گیری را اضافه کن تا مانده‌ات را دنبال کنی."
            actionLabel="افزودن شخص"
            onAction={openCreate}
          />
        ) : (
          <>
            <p className="px-1 text-xs text-zinc-500">برای جابجایی، دستگیره را بکش.</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={persons.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface-raised divide-y divide-white/5">
                  {persons.map((person) => {
                    const balance = balances.get(person.id) ?? 0;
                    return (
                      <SortablePersonRow
                        key={person.id}
                        person={person}
                        balance={balance}
                        onOpen={() => router.push(`/deadlines/persons/${person.id}`)}
                        onMore={() => setActionPersonId(person.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      <ActionSheet
        open={actionPerson !== null}
        onClose={() => setActionPersonId(null)}
        title={actionPerson?.name}
        actions={
          actionPerson
            ? [
                { label: 'تغییر نام', icon: <Edit3 size={17} />, onSelect: () => handleEdit(actionPerson) },
                {
                  label: 'حذف',
                  icon: <Trash2 size={17} />,
                  tone: 'danger',
                  onSelect: () => void handleDelete(actionPerson),
                },
              ]
            : []
        }
      />

      <BottomSheet open={sheetOpen} onClose={reset} title={editingId ? 'تغییر نام' : 'شخص جدید'}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="نام">
            <input
              type="text"
              placeholder="مثلاً رضا"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldInputClass}
              data-autofocus
              required
            />
          </Field>
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ثبت...' : editingId ? 'ذخیره' : 'افزودن'}
          </PrimaryButton>
        </form>
      </BottomSheet>
    </div>
  );
}

function SortablePersonRow({
  person,
  balance,
  onOpen,
  onMore,
}: {
  person: Person;
  balance: number;
  onOpen: () => void;
  onMore: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: person.id });
  const status = balance > 0 ? 'بدهکار' : balance < 0 ? 'بستانکار' : 'تسویه';
  const tone = balance > 0 ? 'text-amber-300' : balance < 0 ? 'text-cyan-300' : 'text-zinc-500';
  return (
    <SortableListRow
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      handleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      onOpen={onOpen}
      onMore={onMore}
      leading={
        <IconBadge color="#22d3ee">
          <UserRound size={17} strokeWidth={1.9} />
        </IconBadge>
      }
      title={person.name}
      subtitle={<span className={tone}>{status}</span>}
      trailing={
        balance !== 0 ? (
          <Money className={`text-sm font-semibold ${tone}`}>
            {Math.abs(balance).toLocaleString('en-US', { maximumFractionDigits: 6 })}
          </Money>
        ) : undefined
      }
    />
  );
}
