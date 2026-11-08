'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Amount, Avatar, Button, List, ListRow, Section, Sheet, toast } from '@/design-system';
import { Repeat } from '@/design-system/icons';
import { supabase } from '@/shared/lib/supabase/client';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { useTransactionActions } from '@/features/transactions/hooks/use-transaction-actions';

interface Run {
  recurring_id: string;
  due_date_string: string;
  transaction_id: string;
  reviewed_at: string | null;
}

/**
 * Transactions the daily job created from recurring rules and the user
 * has not reviewed yet (S24). Confirm, edit or delete each one.
 * Hidden when there is nothing to review or the column is not deployed.
 */
export function RecurringReview() {
  const { transactions, categories } = useData();
  const actions = useTransactionActions();
  const [runs, setRuns] = useState<Run[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [open, setOpen] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([
        supabase.from('recurring_transaction_runs').select('*').is('reviewed_at', null),
        supabase.from('recurring_transactions').select('id,title'),
      ]),
    []
  );
  const apply = useCallback((res: Awaited<ReturnType<typeof load>>) => {
    const [r, t] = res;
    if (!r.error) setRuns((r.data ?? []) as Run[]);
    if (!t.error) setTitles(new Map(((t.data ?? []) as { id: string; title: string }[]).map((x) => [x.id, x.title])));
  }, []);
  useEffect(() => {
    let cancelled = false;
    void load().then((res) => !cancelled && apply(res));
    return () => {
      cancelled = true;
    };
  }, [load, apply]);

  const pending = runs.filter((r) => transactions.some((t) => t.id === r.transaction_id));
  if (pending.length === 0) return null;

  const markReviewed = async (rows: Run[]) => {
    const now = new Date().toISOString();
    for (const r of rows) {
      await supabase
        .from('recurring_transaction_runs')
        .update({ reviewed_at: now })
        .eq('recurring_id', r.recurring_id)
        .eq('due_date_string', r.due_date_string);
    }
    setRuns((prev) => prev.filter((p) => !rows.includes(p)));
  };

  return (
    <>
      <Section title="تراکنش‌های دوره‌ای جدید">
        <List>
          <ListRow
            onClick={() => setOpen(true)}
            leading={<Avatar tone="mint" fallback={<Repeat />} />}
            title={`${pending.length.toLocaleString('fa-IR')} تراکنش خودکار ثبت شد`}
            subtitle="بررسی و تأیید کن"
          />
        </List>
      </Section>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="بررسی تراکنش‌های دوره‌ای"
        footer={
          <Button
            fullWidth
            size="lg"
            onClick={async () => {
              await markReviewed(pending);
              setOpen(false);
              toast.success('همه تأیید شد');
            }}
          >
            تأیید همه
          </Button>
        }
      >
        <List variant="plain">
          {pending.map((r) => {
            const tx = transactions.find((t) => t.id === r.transaction_id)!;
            const cat = categories.find((c) => c.id === tx.category_id)?.name;
            const amount = tx.type === 'EXPENSE' ? -Number(tx.source_amount) : Number(tx.target_amount);
            return (
              <ListRow
                key={r.transaction_id}
                chevron={false}
                title={titles.get(r.recurring_id) ?? cat ?? 'تراکنش دوره‌ای'}
                subtitle={`${r.due_date_string}${cat ? ` · ${cat}` : ''}`}
                trailing={
                  <span className="flex flex-col items-end gap-1.5">
                    <Amount value={amount} size="sm" tone="auto" signed={amount > 0} />
                    <span className="flex gap-1">
                      <Button size="sm" variant="soft" onClick={() => void markReviewed([r])}>
                        تأیید
                      </Button>
                      <Button size="sm" variant="ghost" render={<Link href={`/transactions/${tx.id}/edit`} />} nativeButton={false}>
                        ویرایش
                      </Button>
                      <Button size="sm" variant="danger" aria-label="حذف" onClick={() => void actions.remove([tx]).then((ok) => ok && setRuns((p) => p.filter((x) => x !== r)))}>
                        حذف
                      </Button>
                    </span>
                  </span>
                }
              />
            );
          })}
        </List>
      </Sheet>
    </>
  );
}
