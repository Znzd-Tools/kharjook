'use client';

/**
 * v2 برنامه tab (UX plan §4, S18–S21).
 * One timeline for checks, installments and subscriptions with one-tap
 * "پرداخت شد" (+ undo), loan cards with progress, people with balances
 * and one-tap settle. Hubs keep every create / edit / schedule feature.
 */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheet,
  Amount,
  AmountField,
  Avatar,
  Badge,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  IconButton,
  List,
  ListRow,
  PickerField,
  PickerSheet,
  ProgressBar,
  Section,
  SegmentedControl,
  Sheet,
  Text,
} from '@/design-system';
import { CalendarDays, CheckCircle2, FileText, Landmark, MoreHorizontal, Users, Zap } from '@/design-system/icons';
import { supabase } from '@/shared/lib/supabase/client';
import type { Loan, LoanInstallment } from '@/shared/types/domain';
import { todayJalaali, formatJalaaliHuman, parseJalaali } from '@/shared/utils/jalali';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { rankEndpoints } from '@/features/transactions/utils/usage-stats';
import { buildPersonSettleTransactionUrl, pickDefaultSettleWallet } from '@/features/persons/utils/person-settle-prefill';
import { DeadlineAmount, deadlineToman } from './DeadlineAmount';
import { currencyTomanRate, personCurrency } from '@/shared/utils/person-currency';
import { PersonAmount } from '@/features/persons/components/PersonAmount';
import { useSettleDeadline } from '@/features/deadlines/hooks/use-settle-deadline';
import { BUCKET_LABEL, buildTimeline, daysLeftLabel, type TimelineBucket, type TimelineItem } from '@/features/deadlines/utils/timeline';

type PlanView = 'due' | 'loans' | 'people';

const KIND_META = {
  check: { icon: <FileText />, tone: 'peach' as const, label: 'چک', hub: '/deadlines/checks' },
  installment: { icon: <Landmark />, tone: 'sky' as const, label: 'قسط', hub: '/deadlines/loans' },
  subscription: { icon: <Zap />, tone: 'lemon' as const, label: 'اشتراک', hub: '/deadlines/subscriptions' },
};

const HUBS = [
  { href: '/deadlines/loans', title: 'اقساط و وام‌ها', subtitle: 'ساخت وام، برنامه اقساط، پرداخت جزئی', icon: <Landmark />, tone: 'sky' as const },
  { href: '/deadlines/checks', title: 'چک‌ها', subtitle: 'ثبت و پیگیری چک‌ها', icon: <FileText />, tone: 'peach' as const },
  { href: '/deadlines/subscriptions', title: 'اشتراک‌ها', subtitle: 'پرداخت‌های دوره‌ای', icon: <Zap />, tone: 'lemon' as const },
  { href: '/deadlines/persons', title: 'اشخاص', subtitle: 'طلب و بدهی', icon: <Users />, tone: 'rose' as const },
];

export function PlanTabV2() {
  const router = useRouter();
  const { checks, activeSubscriptions, upcomingDeadlines, wallets, persons, transactions, currencyRates } = useData();
  const { usdRate } = useUI();
  const today = useMemo(() => todayJalaali(), []);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [allInstallments, setAllInstallments] = useState<LoanInstallment[]>([]);
  const searchParams = useSearchParams();
  const [view, setView] = useState<PlanView>(() => {
    const v = searchParams.get('v');
    return v === 'loans' || v === 'people' ? v : 'due';
  });
  const changeView = (v: PlanView) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === 'due') url.searchParams.delete('v');
    else url.searchParams.set('v', v);
    window.history.replaceState(null, '', url);
  };
  const [kindFilter, setKindFilter] = useState<'all' | TimelineItem['kind']>('all');
  const [menuFor, setMenuFor] = useState<TimelineItem | null>(null);
  const [walletPickFor, setWalletPickFor] = useState<TimelineItem | null>(null);
  const [partialFor, setPartialFor] = useState<TimelineItem | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialWallet, setPartialWallet] = useState<string | null>(null);

  const fetchLoans = useCallback(
    () =>
      Promise.all([
        supabase.from('loans').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('loan_installments').select('*').order('due_date_string', { ascending: true }),
      ]),
    []
  );
  const applyLoans = useCallback((res: Awaited<ReturnType<typeof fetchLoans>>) => {
    const [l, i] = res;
    if (!l.error) setLoans((l.data ?? []) as Loan[]);
    if (!i.error) setAllInstallments((i.data ?? []) as LoanInstallment[]);
  }, []);
  const loadLoans = useCallback(async () => applyLoans(await fetchLoans()), [applyLoans, fetchLoans]);
  useEffect(() => {
    let cancelled = false;
    void fetchLoans().then((res) => {
      if (!cancelled) applyLoans(res);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchLoans, applyLoans]);

  const loanById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);
  const items = useMemo(
    () =>
      buildTimeline(
        {
          checks,
          subscriptions: activeSubscriptions,
          installments: upcomingDeadlines.map((i) => ({
            ...i,
            loanAssetId: loanById.get(i.loan_id)?.asset_id ?? null,
            loanWalletId: loanById.get(i.loan_id)?.auto_income_wallet_id ?? null,
          })),
        },
        today
      ),
    [checks, activeSubscriptions, upcomingDeadlines, loanById, today]
  );

  const { pay, busyKey } = useSettleDeadline(loadLoans);

  const defaultWallet = useMemo(() => {
    const ranked = rankEndpoints(transactions, 'EXPENSE', 'source', ['wallet'])[0]?.id;
    return ranked ?? wallets[0]?.id ?? null;
  }, [transactions, wallets]);

  // Every currency counts, through its rate (₺ 299 → Toman). Asset-based installments are quantities, not money.
  const monthTotalToman = items
    .filter((i) => i.bucket !== 'later' && !i.assetId)
    .reduce((s, i) => s + deadlineToman(i.amount, i.currency, currencyRates), 0);

  /* ------------------------------ pay ------------------------------ */

  const walletFor = (item: TimelineItem) => item.walletId ?? defaultWallet;
  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name ?? '—';

  /* ------------------------------ view ------------------------------ */

  const buckets: TimelineBucket[] = ['overdue', 'week', 'month', 'later'];
  const debts = persons
    .map((p) => {
      const currency = personCurrency(p);
      const balance = calculatePersonBalance(p, transactions);
      // Totals are in Toman; a USD person converts at today's rate.
      return { person: p, currency, balance, toman: balance * currencyTomanRate(currency, currencyRates, usdRate) };
    })
    .filter((x) => Math.abs(x.balance) > (x.currency === 'IRT' ? 0.5 : 0.005));

  const shown = items.filter(
    (i) => kindFilter === 'all' || i.kind === kindFilter
  );
  const owedToMe = debts.filter((d) => d.balance > 0).reduce((s2, d) => s2 + d.toman, 0);
  const iOwe = debts.filter((d) => d.balance < 0).reduce((s2, d) => s2 - d.toman, 0);

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-6">
      <SegmentedControl
        aria-label="بخش برنامه"
        value={view}
        onValueChange={(v) => changeView(v as PlanView)}
        options={[
          { value: 'due', label: 'سررسیدها' },
          { value: 'loans', label: `وام‌ها${loans.length ? ` (${loans.length.toLocaleString('fa-IR')})` : ''}` },
          { value: 'people', label: `طلب و بدهی${debts.length ? ` (${debts.length.toLocaleString('fa-IR')})` : ''}` },
        ]}
      />

      {view === 'due' && (
      <>
      <nav aria-label="مدیریت" className="grid grid-cols-2 gap-2">
        {HUBS.filter((h) => h.href !== '/deadlines/persons' && h.href !== '/deadlines/loans').map((h) => (
          <Link key={h.href} href={h.href} className="ds-focus flex items-center gap-2.5 rounded-card bg-panel p-3 hover:bg-hover">
            <Avatar size="sm" tone={h.tone} fallback={h.icon} />
            <span className="min-w-0">
              <span className="block truncate text-callout font-semibold text-fg">{h.title}</span>
              <span className="block truncate text-micro text-fg-subtle">مدیریت و ثبت جدید</span>
            </span>
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-between gap-3 rounded-card bg-panel p-4">
        <div>
          <Text variant="caption" tone="subtle">
            سررسیدهای این ماه
          </Text>
          <Amount value={monthTotalToman} size="lg" compact />
        </div>
        <Avatar size="lg" tone="lilac" fallback={<CalendarDays />} />
      </div>

      {items.length > 0 && (
        <div className="-mx-(--ds-gutter) space-y-2 overflow-x-auto px-(--ds-gutter) scrollbar-hide">
          <ChipGroup aria-label="نوع سررسید" value={[kindFilter]} onValueChange={(v) => v[0] && setKindFilter(v[0] as typeof kindFilter)}>
            <Chip value="all">همه</Chip>
            <Chip value="check">چک</Chip>
            <Chip value="installment">قسط</Chip>
            <Chip value="subscription">اشتراک</Chip>
          </ChipGroup>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-card bg-panel">
          <EmptyState icon={<CheckCircle2 />} title="سررسیدی نداری" description="قسط، چک یا اشتراک که بسازی، اینجا به ترتیب تاریخ می‌آید." />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-card bg-panel">
          <EmptyState compact title="با این فیلتر چیزی نیست" />
        </div>
      ) : (
        buckets.map((b) => {
          const list = shown.filter((i) => i.bucket === b).slice(0, b === 'later' && kindFilter === 'all' ? 6 : undefined);
          if (list.length === 0) return null;
          return (
            <Section key={b} title={BUCKET_LABEL[b]} description={`${list.length.toLocaleString('fa-IR')} مورد`}>
              <List>
                {list.map((item) => {
                  const meta = KIND_META[item.kind];
                  const date = parseJalaali(item.due);
                  return (
                    <ListRow
                      key={item.key}
                      chevron={false}
                      leading={<Avatar tone={meta.tone} fallback={meta.icon} />}
                      title={item.title}
                      subtitle={
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <Badge tone={item.daysLeft < 0 ? 'negative' : item.daysLeft <= 2 ? 'warning' : 'neutral'}>{daysLeftLabel(item.daysLeft)}</Badge>
                          {date ? formatJalaaliHuman(date) : item.due}
                          {item.partial && <Badge tone="info">پرداخت جزئی</Badge>}
                        </span>
                      }
                      trailing={
                        <span className="flex flex-col items-end gap-1.5">
                          {item.assetId ? (
                            <span className="tabular text-callout">{item.amount.toLocaleString('fa-IR', { maximumFractionDigits: 6 })}</span>
                          ) : (
                            <DeadlineAmount value={item.amount} currency={item.currency} />
                          )}
                          <span className="flex items-center gap-1">
                            <IconButton size="sm" aria-label={`گزینه‌های ${item.title}`} icon={<MoreHorizontal />} onClick={() => setMenuFor(item)} />
                            <Button
                              size="sm"
                              variant="soft"
                              loading={busyKey === item.key}
                              aria-label={`پرداخت ${item.title}`}
                              onClick={() => void pay(item, walletFor(item))}
                            >
                              پرداخت شد
                            </Button>
                          </span>
                        </span>
                      }
                    />
                  );
                })}
              </List>
            </Section>
          );
        })
      )}

      </>
      )}

      {view === 'loans' && loans.length === 0 && (
        <div className="rounded-card bg-panel">
          <EmptyState icon={<Landmark />} title="وامی نداری" action={<Button render={<Link href="/deadlines/loans" />} nativeButton={false}>ساخت وام</Button>} />
        </div>
      )}
      {view === 'loans' && loans.length > 0 && (() => {
        const row = (loan: Loan) => {
          const rows = allInstallments.filter((i) => i.loan_id === loan.id);
          const paidCount = rows.filter((i) => i.is_paid).length;
          const next = rows.find((i) => !i.is_paid);
          return (
            <ListRow
              key={loan.id}
              render={<Link href="/deadlines/loans" />}
              leading={<Avatar tone="sky" fallback={<Landmark />} />}
              title={loan.title}
              subtitle={
                <span className="block w-full space-y-1 pt-1">
                  <ProgressBar
                    tone="positive"
                    value={paidCount}
                    max={Math.max(rows.length, 1)}
                    valueLabel={`${paidCount.toLocaleString('fa-IR')} از ${rows.length.toLocaleString('fa-IR')} قسط`}
                  />
                  {next && <span className="text-micro text-fg-subtle">قسط بعد: {formatJalaaliHuman(parseJalaali(next.due_date_string)!)}</span>}
                </span>
              }
            />
          );
        };
        const isDone = (loan: Loan) => {
          const rows = allInstallments.filter((i) => i.loan_id === loan.id);
          return rows.length > 0 && rows.every((i) => i.is_paid);
        };
        const active = loans.filter((l) => !isDone(l));
        const done = loans.filter(isDone);
        return (
          <>
            <Section title="وام‌های فعال" action={<Button variant="link" size="sm" render={<Link href="/deadlines/loans" />} nativeButton={false}>مدیریت و وام جدید</Button>}>
              {active.length ? <List>{active.map(row)}</List> : <Text variant="caption" tone="subtle">همه وام‌ها تسویه شده‌اند.</Text>}
            </Section>
            {done.length > 0 && (
              <Section title={`تمام‌شده (${done.length.toLocaleString('fa-IR')})`}>
                <List>{done.map(row)}</List>
              </Section>
            )}
          </>
        );
      })()}

      {view === 'people' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card bg-panel p-4">
            <Text variant="caption" tone="subtle">طلب من</Text>
            <Amount value={owedToMe} size="md" compact tone="positive" />
          </div>
          <div className="rounded-card bg-panel p-4">
            <Text variant="caption" tone="subtle">بدهی من</Text>
            <Amount value={iOwe} size="md" compact tone="negative" />
          </div>
        </div>
      )}
      {view === 'people' && debts.length === 0 && (
        <div className="rounded-card bg-panel">
          <EmptyState icon={<Users />} title="با کسی حساب باز نداری" action={<Button render={<Link href="/deadlines/persons" />} nativeButton={false}>اشخاص</Button>} />
        </div>
      )}
      {view === 'people' && debts.length > 0 && (
        <Section title="طلب و بدهی" action={<Button variant="link" size="sm" render={<Link href="/deadlines/persons" />} nativeButton={false}>همه اشخاص</Button>}>
          <List>
            {debts.map(({ person, balance, currency }) => {
              const settleWallet = pickDefaultSettleWallet(wallets, currency)?.id ?? defaultWallet;
              const url = settleWallet ? buildPersonSettleTransactionUrl({ personId: person.id, walletId: settleWallet, balance }) : null;
              return (
                <ListRow
                  key={person.id}
                  chevron={false}
                  leading={<Avatar name={person.name} tone="rose" />}
                  title={
                    <Link href={`/deadlines/persons/${person.id}`} className="ds-focus rounded hover:underline">
                      {person.name}
                    </Link>
                  }
                  subtitle={balance > 0 ? 'به تو بدهکار است' : 'تو بدهکاری'}
                  trailing={
                    <span className="flex flex-col items-end gap-1.5">
                      <PersonAmount currency={currency} value={Math.abs(balance)} size="sm" compact tone={balance > 0 ? 'positive' : 'negative'} />
                      {url && (
                        <Button size="sm" variant="soft" onClick={() => router.push(url)}>
                          تسویه
                        </Button>
                      )}
                    </span>
                  }
                />
              );
            })}
          </List>
        </Section>
      )}

      <ActionSheet
        open={menuFor !== null}
        onOpenChange={(o) => !o && setMenuFor(null)}
        title={menuFor?.title}
        actions={
          menuFor
            ? [
                ...(menuFor.assetId
                  ? [{ key: 'full', label: 'پرداخت کامل', onSelect: () => void pay(menuFor, null) }]
                  : [
                      { key: 'full', label: `پرداخت از ${walletName(walletFor(menuFor))}`, onSelect: () => void pay(menuFor, walletFor(menuFor)) },
                      { key: 'other', label: 'پرداخت از کیف پول دیگر…', onSelect: () => setWalletPickFor(menuFor) },
                    ]),
                ...(menuFor.kind === 'installment'
                  ? [
                      {
                        key: 'partial',
                        label: 'پرداخت جزئی…',
                        onSelect: () => {
                          setPartialAmount('');
                          setPartialWallet(walletFor(menuFor));
                          setPartialFor(menuFor);
                        },
                      },
                    ]
                  : []),
                { key: 'details', label: 'جزئیات و ویرایش', onSelect: () => router.push(KIND_META[menuFor.kind].hub) },
              ]
            : []
        }
      />

      <PickerSheet
        open={walletPickFor !== null}
        onOpenChange={(o) => !o && setWalletPickFor(null)}
        title="پرداخت از"
        options={wallets.map((w) => ({ value: w.id, label: w.name, description: w.currency }))}
        value={null}
        onValueChange={(id) => {
          const item = walletPickFor;
          setWalletPickFor(null);
          if (item) void pay(item, id);
        }}
      />

      <Sheet
        open={partialFor !== null}
        onOpenChange={(o) => !o && setPartialFor(null)}
        title={`پرداخت جزئی ${partialFor?.title ?? ''}`}
        description={partialFor ? `باقی‌مانده: ${partialFor.amount.toLocaleString('fa-IR')}` : undefined}
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={!(Number(partialAmount) > 0) || (partialFor ? Number(partialAmount) > partialFor.amount : true)}
            onClick={() => {
              const item = partialFor;
              setPartialFor(null);
              if (item) void pay(item, partialWallet, Number(partialAmount));
            }}
          >
            ثبت پرداخت
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="مبلغ" error={partialFor && Number(partialAmount) > partialFor.amount ? 'بیشتر از باقی‌مانده است' : undefined}>
            <AmountField value={partialAmount} onValueChange={setPartialAmount} autoFocus />
          </Field>
          {partialFor && !partialFor.assetId && (
            <Field label="از کیف پول">
              <PickerField
                title="کیف پول"
                options={wallets.map((w) => ({ value: w.id, label: w.name }))}
                value={partialWallet}
                onValueChange={setPartialWallet}
              />
            </Field>
          )}
        </div>
      </Sheet>
    </div>
  );
}
