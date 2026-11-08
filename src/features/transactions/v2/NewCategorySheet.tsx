'use client';

import { useState } from 'react';
import { Button, Field, Input, Sheet, toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import type { Category } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';

const DEFAULT_COLOR = { expense: '#f472b6', income: '#34d399' } as const;

/** Create a category without leaving the add screen (S3). */
export function NewCategorySheet({
  open,
  onOpenChange,
  kind,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'expense' | 'income';
  onCreated: (category: Category) => void;
}) {
  const { user } = useAuth();
  const { categories, setCategories } = useData();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!user || !trimmed) return;
    if (categories.some((c) => c.kind === kind && c.name.trim() === trimmed)) {
      toast.warning('این دسته‌بندی وجود دارد');
      return;
    }
    setSaving(true);
    const nextOrder = categories.filter((c) => c.kind === kind).reduce((m, c) => Math.max(m, c.order_index ?? 0), -1) + 1;
    const { data, error } = await supabase
      .from('categories')
      .insert([{ user_id: user.id, name: trimmed, color: DEFAULT_COLOR[kind], kind, parent_id: null, order_index: nextOrder }])
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error('ساخت دسته‌بندی انجام نشد');
      return;
    }
    const saved = data as Category;
    setCategories((prev) => [...prev, saved]);
    onCreated(saved);
    setName('');
    onOpenChange(false);
    toast.success(`«${saved.name}» ساخته شد`);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={kind === 'expense' ? 'دسته‌بندی هزینه جدید' : 'دسته‌بندی درآمد جدید'}
      footer={
        <Button fullWidth size="lg" loading={saving} disabled={!name.trim()} onClick={() => void save()}>
          ساخت و انتخاب
        </Button>
      }
    >
      <Field label="نام" hint="زیردسته و رنگ را بعداً در تنظیمات دسته‌بندی‌ها تغییر بده.">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً باشگاه" autoFocus maxLength={40} />
      </Field>
    </Sheet>
  );
}
