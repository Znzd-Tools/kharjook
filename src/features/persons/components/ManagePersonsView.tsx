'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Amount, Avatar, Button, EmptyState, IconButton, Input, Section, TopBar } from '@/design-system';
import { Pencil, Plus, Trash2, Users } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
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
import type { Person } from '@/shared/types/domain';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';

export function ManagePersonsView() {
  const router = useRouter();
  const goBack = useSafeBack('/deadlines?v=people');
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { persons, transactions, setPersons } = useData();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title="اشخاص" />
      <div className="space-y-5 px-(--ds-gutter)">
        <form onSubmit={onSubmit} className="space-y-3 rounded-card bg-panel p-4">
          <p className="text-callout font-semibold text-fg">{editingId ? 'ویرایش شخص' : 'شخص جدید'}</p>
          <Input aria-label="نام شخص" placeholder="نام شخص" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex gap-2">
            <Button type="submit" loading={isSubmitting} startIcon={editingId ? undefined : <Plus />} className="flex-1">
              {editingId ? 'ثبت تغییرات' : 'ذخیره شخص'}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={reset}>
                انصراف
              </Button>
            )}
          </div>
        </form>

        <Section title="لیست اشخاص" description="برای جابه‌جایی، دستگیره کنار هر نام را بکش.">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={persons.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {persons.map((person) => (
                  <SortablePersonRow
                    key={person.id}
                    person={person}
                    isEditing={editingId === person.id}
                    balance={balances.get(person.id) ?? 0}
                    onOpen={() => router.push(`/deadlines/persons/${person.id}`)}
                    onEdit={() => handleEdit(person)}
                    onDelete={() => void handleDelete(person)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {persons.length === 0 && (
            <div className="rounded-card bg-panel">
              <EmptyState icon={<Users />} title="هنوز شخصی ثبت نشده" description="از فرم بالا اولین شخص را اضافه کن." />
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function SortablePersonRow({
  person,
  isEditing,
  balance,
  onOpen,
  onEdit,
  onDelete,
}: {
  person: Person;
  isEditing: boolean;
  balance: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: person.id });
  const status = balance > 0.5 ? 'به تو بدهکار است' : balance < -0.5 ? 'تو بدهکاری' : 'تسویه';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-card bg-panel p-3 ${isEditing ? 'ring-1 ring-accent' : ''} ${isDragging ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="ds-focus cursor-grab rounded px-1 text-fg-subtle active:cursor-grabbing"
        aria-label={`جابجایی ${person.name}`}
      >
        ⋮⋮
      </button>
      <button type="button" onClick={onOpen} className="ds-focus flex min-w-0 flex-1 items-center gap-3 rounded text-start">
        <Avatar name={person.name} tone="rose" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-callout font-semibold text-fg">{person.name}</span>
          <span className="flex items-center gap-1 text-caption text-fg-subtle">
            {status}
            {Math.abs(balance) > 0.5 && <Amount value={Math.abs(balance)} size="xs" compact tone={balance > 0 ? 'positive' : 'negative'} />}
          </span>
        </span>
      </button>
      <IconButton size="sm" aria-label={`ویرایش ${person.name}`} icon={<Pencil />} onClick={onEdit} />
      <IconButton size="sm" aria-label={`حذف ${person.name}`} icon={<Trash2 />} onClick={onDelete} />
    </li>
  );
}
