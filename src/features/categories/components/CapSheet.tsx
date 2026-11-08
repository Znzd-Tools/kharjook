'use client';

import { useState } from 'react';
import { AmountField, Button, Field, Sheet, toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';

/**
 * Set, change or remove a category's monthly cap where you see the spend
 * (UX plan S26). Same table and rules as the category manager.
 */
export function CapSheet({
  categoryId,
  onOpenChange,
}: {
  categoryId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { categories, spendingCaps, refresh } = useData();
  const current = spendingCaps.find((c) => c.category_id === categoryId);
  const name = categories.find((c) => c.id === categoryId)?.name ?? '';
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (categoryId !== lastId) {
    setLastId(categoryId);
    setValue(current ? String(current.monthly_limit_toman) : '');
  }

  const save = async (remove = false) => {
    if (!user || !categoryId) return;
    setSaving(true);
    const res = remove
      ? await supabase.from('category_spending_caps').delete().eq('category_id', categoryId)
      : await supabase
          .from('category_spending_caps')
          .upsert(
            { user_id: user.id, category_id: categoryId, monthly_limit_toman: Number(value), updated_at: new Date().toISOString() },
            { onConflict: 'user_id,category_id' }
          );
    setSaving(false);
    if (res.error) {
      toast.error('ذخیره سقف انجام نشد');
      return;
    }
    await refresh();
    onOpenChange(false);
    toast.success(remove ? `سقف «${name}» برداشته شد` : `سقف «${name}» ذخیره شد`);
  };

  return (
    <Sheet
      open={categoryId !== null}
      onOpenChange={onOpenChange}
      title={`سقف ماهانه «${name}»`}
      footer={
        <div className="flex gap-2">
          <Button fullWidth size="lg" loading={saving} disabled={!(Number(value) > 0)} onClick={() => void save()}>
            ذخیره
          </Button>
          {current && (
            <Button size="lg" variant="danger" disabled={saving} onClick={() => void save(true)}>
              برداشتن
            </Button>
          )}
        </div>
      }
    >
      <Field label="حداکثر هزینه در ماه" hint="وقتی به ۸۰٪ برسی هشدار می‌بینی.">
        <AmountField value={value} onValueChange={setValue} autoFocus />
      </Field>
    </Sheet>
  );
}
