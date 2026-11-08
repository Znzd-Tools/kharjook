'use client';

/**
 * Bank SMS inbox: each SMS sent by the phone forwarder waits here.
 * One main button (the best guess), "گزینه‌های دیگر" for the rest,
 * and "نادیده" with undo. Nothing is saved without a tap.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheet,
  Amount,
  Avatar,
  Button,
  Disclosure,
  EmptyState,
  IconButton,
  Skeleton,
  Text,
  TopBar,
  toast,
} from '@/design-system';
import { ArrowDownLeft, ArrowUpLeft, MessageMoney, MoreHorizontal, X } from '@/design-system/icons';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { supabase } from '@/shared/lib/supabase/client';
import type { Loan } from '@/shared/types/domain';
import { formatJalaali, jalaaliOfDate, todayJalaali } from '@/shared/utils/jalali';
import { buildTimeline } from '@/features/deadlines/utils/timeline';
import { useSettleDeadline } from '@/features/deadlines/hooks/use-settle-deadline';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { useSmsInbox } from '../hooks/use-sms-inbox';
import { markSmsDone, setSmsStatus } from '../utils/sms-client';
import { buildSuggestion, type SmsChoice, type SmsRow } from '../utils/suggest';

const fa = (n: number) => n.toLocaleString('fa-IR');
const receivedDate = (iso: string) => formatJalaali(jalaaliOfDate(new Date(iso)));
const KIND_LABEL: Record<string, string> = {
  purchase: 'خرید', transfer: 'انتقال', cash: 'برداشت نقدی', fee: 'کارمزد', loan: 'قسط', check: 'چک',
  salary: 'حقوق', profit: 'سود', deposit: 'واریز', withdraw: 'برداشت',
};

export function SmsInboxView() {
  const router = useRouter();
  const goBack = useSafeBack('/transactions');
  const { wallets, transactions, checks, activeSubscriptions, upcomingDeadlines } = useData();
  const { rows, loaded, setRows } = useSmsInbox();
  const [setup, setSetup] = useState<boolean | null>(null);
  const [more, setMore] = useState<{ sms: SmsRow; choices: SmsChoice[] } | null>(null);
  const [loans, setLoans] = useState<Pick<Loan, 'id' | 'title' | 'currency' | 'asset_id' | 'auto_income_wallet_id'>[]>([]);

  useEffect(() => {
    void fetch('/api/sms/token')
      .then((r) => (r.ok ? r.json() : { active: false }))
      .then((j: { active?: boolean }) => setSetup(Boolean(j.active)))
      .catch(() => setSetup(false));
    void supabase
      .from('loans')
      .select('id, title, currency, asset_id, auto_income_wallet_id')
      .is('deleted_at', null)
      .then(({ data }) => setLoans((data ?? []) as typeof loans));
  }, []);

  const deadlines = useMemo(() => {
    const byId = new Map(loans.map((l) => [l.id, l]));
    return buildTimeline(
      {
        checks,
        subscriptions: activeSubscriptions,
        installments: upcomingDeadlines.map((i) => ({
          ...i,
          loanTitle: byId.get(i.loan_id)?.title,
          loanCurrency: byId.get(i.loan_id)?.currency,
          loanAssetId: byId.get(i.loan_id)?.asset_id ?? null,
          loanWalletId: byId.get(i.loan_id)?.auto_income_wallet_id ?? null,
        })),
      },
      todayJalaali()
    );
  }, [checks, activeSubscriptions, upcomingDeadlines, loans]);

  const { pay } = useSettleDeadline();
  const fresh = rows.filter((r) => r.status === 'new');
  const ignored = rows.filter((r) => r.status === 'ignored').slice(0, 20);
  const suggestions = useMemo(
    () => new Map(fresh.map((r) => [r.id, buildSuggestion(r, { wallets, transactions, inbox: rows, deadlines, receivedDate })])),
    [fresh, rows, wallets, transactions, deadlines]
  );

  const drop = (id: string, status: SmsRow['status']) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

  const run = async (sms: SmsRow, choice: SmsChoice, walletId: string | null) => {
    if (choice.type === 'form') return router.push(choice.href);
    if (choice.type === 'match') {
      if (await markSmsDone(sms.id, choice.transactionId, walletId)) {
        drop(sms.id, 'done');
        toast.success('به تراکنش ثبت‌شده وصل شد');
      }
      return;
    }
    const txId = await pay(choice.item, choice.walletId ?? walletId);
    if (txId) {
      await markSmsDone(sms.id, txId, choice.walletId ?? walletId);
      drop(sms.id, 'done');
    }
  };

  const ignore = async (sms: SmsRow) => {
    if (!(await setSmsStatus(sms.id, 'ignored'))) return toast.error('انجام نشد');
    drop(sms.id, 'ignored');
    toast.show('پیامک نادیده گرفته شد', {
      action: {
        label: 'برگردان',
        onClick: () => void setSmsStatus(sms.id, 'new').then((ok) => ok && drop(sms.id, 'new')),
      },
    });
  };

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title="پیامک‌های بانکی" />
      <div className="space-y-4 px-(--ds-gutter)">
        {!loaded ? (
          <>
            <Skeleton className="h-32 rounded-card" />
            <Skeleton className="h-32 rounded-card" />
          </>
        ) : fresh.length === 0 ? (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<MessageMoney />}
              title={setup === false ? 'ثبت خودکار پیامک روشن نیست' : 'پیامک تازه‌ای نیست'}
              description={
                setup === false
                  ? 'یک برنامه ارسال پیامک روی اندروید نصب کن تا پیامک‌های بانک خودکار اینجا بیایند.'
                  : 'پیامک‌های بانکی که برسند، اینجا برای تأیید می‌آیند.'
              }
              action={
                setup === false ? (
                  <Button render={<Link href="/settings#sms" />} nativeButton={false}>
                    راه‌اندازی
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="space-y-3" aria-label="پیامک‌های تازه">
            {fresh.map((sms) => {
              const s = suggestions.get(sms.id)!;
              const p = sms.parsed;
              const out = p.direction === 'out';
              const walletName = wallets.find((w) => w.id === s.walletId)?.name;
              const [main, ...rest] = s.choices;
              return (
                <li key={sms.id} className="space-y-3 rounded-card bg-panel p-4" aria-label={`پیامک ${fa(p.amountToman)} تومان`}>
                  <div className="flex items-start gap-3">
                    <Avatar tone={out ? 'rose' : 'mint'} fallback={out ? <ArrowUpLeft /> : <ArrowDownLeft />} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <Text variant="callout" className="truncate font-semibold">
                          {KIND_LABEL[p.kind] ?? (out ? 'برداشت' : 'واریز')}
                          {p.bank ? ` · ${p.bank}` : ''}
                        </Text>
                        <Amount value={out ? -p.amountToman : p.amountToman} size="sm" tone="auto" signed={!out} />
                      </div>
                      <Text variant="caption" tone="subtle" className="truncate">
                        {s.date}
                        {p.time ? ` ${p.time}` : ''}
                        {walletName ? ` · ${walletName}` : ' · کیف پول نامعلوم'}
                        {p.note ? ` · ${p.note}` : ''}
                      </Text>
                    </div>
                  </div>
                  {s.duplicate && (
                    <Text variant="caption" tone="warning">
                      شاید قبلاً ثبت کرده‌ای: {s.duplicate.note || 'تراکنش'} · {s.duplicate.date_string}
                    </Text>
                  )}
                  <div className="flex items-center gap-2">
                    {main && (
                      <Button size="sm" className="flex-1" onClick={() => void run(sms, main, s.walletId)}>
                        {main.label}
                      </Button>
                    )}
                    <IconButton aria-label="گزینه‌های دیگر" icon={<MoreHorizontal />} onClick={() => setMore({ sms, choices: rest })} />
                    <IconButton aria-label="نادیده گرفتن" icon={<X />} onClick={() => void ignore(sms)} />
                  </div>
                  <Disclosure title="متن پیامک">
                    <p className="text-caption whitespace-pre-line text-fg-muted" dir="auto">
                      {sms.body}
                    </p>
                  </Disclosure>
                </li>
              );
            })}
          </ul>
        )}

        {ignored.length > 0 && (
          <Disclosure title={`نادیده‌گرفته‌ها (${fa(ignored.length)})`}>
            <ul className="space-y-2">
              {ignored.map((sms) => (
                <li key={sms.id} className="flex items-center justify-between gap-2 text-caption text-fg-muted">
                  <span className="truncate">
                    {sms.parsed.direction === 'out' ? 'برداشت' : 'واریز'} {fa(sms.parsed.amountToman)} تومان · {receivedDate(sms.received_at)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void setSmsStatus(sms.id, 'new').then((ok) => ok && drop(sms.id, 'new'))}>
                    برگرداندن
                  </Button>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

        {setup && (
          <Text variant="caption" tone="subtle" className="block text-center">
            <Link href="/settings#sms" className="underline">
              تنظیمات ثبت خودکار پیامک
            </Link>
          </Text>
        )}
      </div>

      <ActionSheet
        open={more !== null}
        onOpenChange={(o) => !o && setMore(null)}
        title="این پیامک چه بود؟"
        actions={(more?.choices ?? []).map((c) => ({
          key: c.key,
          label: c.label,
          onSelect: () => {
            const m = more;
            setMore(null);
            if (m) void run(m.sms, c, suggestions.get(m.sms.id)?.walletId ?? null);
          },
        }))}
      />
    </div>
  );
}
