'use client';

/**
 * Budget envelopes (Plan tab → بودجه). Give every toman of this month's
 * income a job; spend from envelopes; move money between them.
 * Caps are envelopes too: one model, not two.
 */
import { useMemo, useState } from 'react';
import {
  Amount,
  AmountField,
  Avatar,
  Banner,
  Button,
  EmptyState,
  Field,
  IconButton,
  PickerField,
  PickerSheet,
  ProgressBar,
  Section,
  Sheet,
  Skeleton,
  Switch,
  Text,
  toast,
  useConfirm,
} from '@/design-system';
import { ChevronLeft, ChevronRight, Wallet } from '@/design-system/icons';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { JALALI_MONTHS, todayJalaali } from '@/shared/utils/jalali';
import { useBudget } from '../hooks/use-budget';
import { monthKey, planMove, shiftMonth, type EnvelopeStatus } from '../utils/budget';

const fa = (n: number) => n.toLocaleString('fa-IR');
const monthLabel = (m: string) => {
  const [y, mm] = m.split('/').map(Number) as [number, number];
  return `${JALALI_MONTHS[mm - 1]} ${fa(y).replace(/٬/g, '')}`;
};

export function BudgetView() {
  const today = useMemo(() => todayJalaali(), []);
  const current = monthKey(today.jy, today.jm);
  const [month, setMonth] = useState(current);
  const { budget, loaded, saveEnvelope, writeAllocations, removeEnvelope } = useBudget(month);
  const { categories } = useData();
  const confirm = useConfirm();

  const [openId, setOpenId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [pickNew, setPickNew] = useState(false);
  const [move, setMove] = useState<{ from: string | null; to: string | null; amount: string } | null>(null);

  const envById = useMemo(() => new Map(budget.envelopes.map((e) => [e.categoryId, e])), [budget.envelopes]);
  const sheetEnv: EnvelopeStatus | null = openId
    ? envById.get(openId) ?? null
    : newId
      ? {
          categoryId: newId,
          name: categories.find((c) => c.id === newId)?.name ?? '',
          color: '',
          rollover: true,
          assigned: 0,
          custom: false,
          monthlyDefault: null,
          carry: 0,
          spent: 0,
          available: 0,
          avgSpent: 0,
        }
      : null;

  const freeCategories = categories
    .filter((c) => c.kind === 'expense' && !envById.has(c.id))
    .map((c) => ({ value: c.id, label: c.name, group: c.parent_id ? 'زیردسته' : 'دسته اصلی' }));
  const envOptions = budget.envelopes.map((e) => ({
    value: e.categoryId,
    label: e.name,
    trailing: <Amount value={e.available} size="xs" compact />,
  }));

  const overspent = budget.envelopes.filter((e) => e.available < 0);
  const unassignedTone = budget.unassigned > 0 ? 'positive' : budget.unassigned < 0 ? 'negative' : 'default';

  return (
    <div className="space-y-6 px-(--ds-gutter) pt-1 pb-6">
      <div className="flex items-center justify-between">
        <IconButton aria-label="ماه قبل" icon={<ChevronRight />} onClick={() => setMonth((m) => shiftMonth(m, -1))} />
        <Text variant="headline">{monthLabel(month)}</Text>
        <IconButton aria-label="ماه بعد" icon={<ChevronLeft />} onClick={() => setMonth((m) => shiftMonth(m, 1))} />
      </div>

      <section aria-label="خلاصه بودجه" className="space-y-3 rounded-card bg-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Text variant="caption" tone="subtle">
              {budget.unassigned >= 0 ? 'پول بدون برنامه' : 'بیشتر از درآمد تقسیم شده'}
            </Text>
            <Amount value={Math.abs(budget.unassigned)} size="lg" tone={unassignedTone} />
          </div>
          <Avatar size="lg" tone="mint" fallback={<Wallet />} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted">
          <span>
            درآمد این ماه: <Amount value={budget.income} size="xs" compact />
          </span>
          <span>
            تقسیم‌شده: <Amount value={budget.assigned} size="xs" compact />
          </span>
          <span>
            خرج‌شده: <Amount value={budget.spent} size="xs" compact />
          </span>
        </div>
        {budget.unassigned > 0 && budget.envelopes.length > 0 && (
          <Text variant="caption" tone="subtle">
            به هر تومان یک کار بده: روی یک پاکت بزن و مبلغش را بیشتر کن.
          </Text>
        )}
      </section>

      {overspent.length > 0 && (
        <Banner tone="warning" title={`${fa(overspent.length)} پاکت بیشتر از برنامه خرج کرده`}>
          <Button
            size="sm"
            variant="soft"
            onClick={() => setMove({ from: null, to: overspent[0]!.categoryId, amount: String(-overspent[0]!.available) })}
          >
            پوشش «{overspent[0]!.name}» از پاکت دیگر
          </Button>
        </Banner>
      )}

      <Section
        title="پاکت‌ها"
        action={
          budget.envelopes.length > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => setMove({ from: null, to: null, amount: '' })}>
              جابه‌جایی پول
            </Button>
          ) : undefined
        }
      >
        {!loaded ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-card" />
            <Skeleton className="h-16 rounded-card" />
          </div>
        ) : budget.envelopes.length === 0 ? (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<Wallet />}
              title="هنوز پاکتی نداری"
              description="برای هر دسته هزینه یک مبلغ ماهانه بگذار. هر هزینه‌ای که ثبت کنی، از پاکت خودش کم می‌شود."
              action={<Button onClick={() => setPickNew(true)}>ساخت اولین پاکت</Button>}
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {budget.envelopes.map((e) => (
              <li key={e.categoryId}>
                <button
                  type="button"
                  aria-label={`پاکت ${e.name}`}
                  onClick={() => setOpenId(e.categoryId)}
                  className="ds-focus block w-full space-y-2 rounded-card bg-panel p-4 text-start hover:bg-hover"
                >
                  <ProgressBar
                    tone="auto"
                    value={e.spent}
                    max={Math.max(e.assigned + e.carry, 1)}
                    label={e.name}
                    valueLabel={
                      <span className={e.available < 0 ? 'text-negative-ink' : undefined}>
                        {e.available < 0 ? 'کسری ' : 'مانده '}
                        <Amount value={Math.abs(e.available)} size="xs" compact tone="inherit" />
                      </span>
                    }
                  />
                  <span className="flex gap-3 text-caption text-fg-subtle">
                    <span>
                      خرج <Amount value={e.spent} size="xs" compact tone="inherit" /> از{' '}
                      <Amount value={e.assigned + e.carry} size="xs" compact tone="inherit" />
                    </span>
                    {e.carry !== 0 && (
                      <span>
                        {e.carry > 0 ? 'از ماه قبل +' : 'کسری ماه قبل '}
                        <Amount value={Math.abs(e.carry)} size="xs" compact tone="inherit" />
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {budget.envelopes.length > 0 && (
          <Button variant="link" size="sm" className="mt-2" onClick={() => setPickNew(true)}>
            + پاکت جدید
          </Button>
        )}
      </Section>

      <PickerSheet
        open={pickNew}
        onOpenChange={setPickNew}
        title="پاکت برای کدام دسته؟"
        options={freeCategories}
        onValueChange={(id) => {
          setPickNew(false);
          setNewId(id);
        }}
      />

      <EnvelopeSheet
        env={sheetEnv}
        isNew={Boolean(newId)}
        month={month}
        onClose={() => {
          setOpenId(null);
          setNewId(null);
        }}
        onSave={async (v) => {
          if (!sheetEnv) return;
          const ok = await saveEnvelope({ categoryId: sheetEnv.categoryId, ...v });
          if (!ok) return toast.error('ذخیره پاکت انجام نشد');
          toast.success(`پاکت «${sheetEnv.name}» ذخیره شد`);
          setOpenId(null);
          setNewId(null);
        }}
        onMove={(env) => {
          setOpenId(null);
          setMove(env.available < 0 ? { from: null, to: env.categoryId, amount: String(-env.available) } : { from: env.categoryId, to: null, amount: '' });
        }}
        onRemove={async (env) => {
          const ok = await confirm({
            title: `پاکت «${env.name}» برداشته شود؟`,
            description: 'سقف ماهانه این دسته هم برداشته می‌شود. ماه‌های گذشته تغییر نمی‌کنند. تراکنش‌ها دست نمی‌خورند.',
            confirmLabel: 'برداشتن',
            tone: 'danger',
          });
          if (!ok) return;
          if (await removeEnvelope(env.categoryId)) {
            toast.show(`پاکت «${env.name}» برداشته شد`);
            setOpenId(null);
          } else toast.error('برداشتن انجام نشد');
        }}
      />

      <Sheet
        open={move !== null}
        onOpenChange={(o) => !o && setMove(null)}
        title="جابه‌جایی پول بین پاکت‌ها"
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={!move?.from || !move?.to || !(Number(move?.amount) > 0)}
            onClick={async () => {
              if (!move?.from || !move.to) return;
              const from = envById.get(move.from);
              const to = envById.get(move.to);
              if (!from || !to) return;
              const plan = planMove(month, from, to, Number(move.amount));
              if (!plan.ok) return toast.error(plan.error);
              if (await writeAllocations(plan.rows)) {
                toast.success(`${fa(Number(move.amount))} تومان از «${from.name}» به «${to.name}» رفت`);
                setMove(null);
              } else toast.error('جابه‌جایی انجام نشد');
            }}
          >
            انتقال
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="از پاکت">
          <PickerField
            title="از پاکت"
            options={envOptions.filter((o) => o.value !== move?.to)}
            value={move?.from ?? null}
            onValueChange={(v) => setMove((m) => (m ? { ...m, from: v } : m))}
          />
          </Field>
          <Field label="به پاکت">
          <PickerField
            title="به پاکت"
            options={envOptions.filter((o) => o.value !== move?.from)}
            value={move?.to ?? null}
            onValueChange={(v) => setMove((m) => (m ? { ...m, to: v } : m))}
          />
          </Field>
          <Field
            label="مبلغ"
            hint={
              move?.from && envById.get(move.from)
                ? `مانده «${envById.get(move.from)!.name}»: ${fa(Math.max(envById.get(move.from)!.available, 0))} تومان`
                : undefined
            }
          >
            <AmountField value={move?.amount ?? ''} onValueChange={(v) => setMove((m) => (m ? { ...m, amount: v } : m))} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}

function EnvelopeSheet({
  env,
  isNew,
  month,
  onClose,
  onSave,
  onMove,
  onRemove,
}: {
  env: EnvelopeStatus | null;
  isNew: boolean;
  month: string;
  onClose: () => void;
  onSave: (v: { amount: number; everyMonth: boolean; rollover: boolean }) => Promise<unknown>;
  onMove: (env: EnvelopeStatus) => void;
  onRemove: (env: EnvelopeStatus) => void;
}) {
  const [amount, setAmount] = useState('');
  const [everyMonth, setEveryMonth] = useState(true);
  const [rollover, setRollover] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = env ? `${env.categoryId}|${month}|${isNew}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (env) {
      setAmount(env.assigned > 0 ? String(env.assigned) : '');
      setEveryMonth(isNew || !env.custom);
      setRollover(isNew ? true : env.rollover);
    }
  }

  return (
    <Sheet
      open={env !== null}
      onOpenChange={(o) => !o && onClose()}
      title={env ? (isNew ? `پاکت جدید: ${env.name}` : `پاکت «${env.name}»`) : ''}
      footer={
        <Button
          fullWidth
          size="lg"
          loading={saving}
          disabled={amount === '' || !(Number(amount) >= 0)}
          onClick={async () => {
            setSaving(true);
            await onSave({ amount: Number(amount), everyMonth, rollover });
            setSaving(false);
          }}
        >
          ذخیره
        </Button>
      }
    >
      {env && (
        <div className="space-y-4">
          {!isNew && (
            <div className="grid grid-cols-3 gap-2 rounded-card bg-sunken p-3 text-center">
              <Stat label="مانده" value={env.available} />
              <Stat label="خرج این ماه" value={env.spent} />
              <Stat label="از ماه قبل" value={env.carry} />
            </div>
          )}
          {env.available < 0 && (
            <Banner tone="warning" title="این پاکت کسری دارد">
              از یک پاکت دیگر پول بیاور تا کسری پوشش داده شود.
            </Banner>
          )}
          <Field label={everyMonth ? 'مبلغ هر ماه' : 'مبلغ فقط برای این ماه'}>
            <AmountField value={amount} onValueChange={setAmount} autoFocus={isNew} />
          </Field>
          {env.avgSpent > 0 && (
            <Button size="sm" variant="soft" onClick={() => setAmount(String(env.avgSpent))}>
              میانگین ۳ ماه قبل: {fa(env.avgSpent)} تومان
            </Button>
          )}
          <Switch
            label="هر ماه همین مبلغ"
            description="خاموش: فقط این ماه. سقف ماهانه و هشدار ۸۰٪ همین مبلغ است."
            checked={everyMonth}
            onCheckedChange={setEveryMonth}
          />
          <Switch
            label="مانده به ماه بعد برود"
            description="مانده (یا کسری) این ماه به ماه بعد اضافه می‌شود. برای خرج‌های سالانه مثل بیمه خوب است."
            checked={rollover}
            onCheckedChange={setRollover}
          />
          {!isNew && (
            <div className="flex gap-2 pt-1">
              <Button variant="soft" onClick={() => onMove(env)}>
                {env.available < 0 ? 'پوشش کسری' : 'انتقال به پاکت دیگر'}
              </Button>
              <Button variant="ghost" className="text-negative-ink" onClick={() => onRemove(env)}>
                برداشتن پاکت
              </Button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <p className="text-micro text-fg-subtle">{label}</p>
      <Amount value={value} size="sm" compact tone={value < 0 ? 'negative' : 'default'} />
    </div>
  );
}
