'use client';

import { useMemo } from 'react';
import { CalendarClock, HandCoins, ReceiptText, Repeat } from 'lucide-react';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { UpcomingList } from '@/features/deadlines/components/UpcomingList';
import { IconBadge, ListGroup, ListRow, Page, Section } from '@/shared/components/ui';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';

export function DeadlinesTab() {
  const { upcomingDeadlines, checks, activeSubscriptions, persons } = useData();
  const today = useMemo(() => formatJalaali(todayJalaali()), []);

  const counts = useMemo(() => {
    const pendingChecks = checks.filter((c) => c.status === 'pending');
    const overdue =
      upcomingDeadlines.filter((i) => i.due_date_string < today).length +
      pendingChecks.filter((c) => c.due_date_string < today).length +
      activeSubscriptions.filter((s) => s.next_due_date_string < today).length;
    return {
      loans: new Set(upcomingDeadlines.map((i) => i.loan_id)).size,
      installments: upcomingDeadlines.length,
      checks: pendingChecks.length,
      subscriptions: activeSubscriptions.length,
      persons: persons.length,
      overdue,
    };
  }, [upcomingDeadlines, checks, activeSubscriptions, persons, today]);

  const n = (v: number) => toPersianDigits(v);

  return (
    <Page>
      {counts.overdue > 0 && (
        <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {n(counts.overdue)} مورد از موعدش گذشته و هنوز پرداخت نشده.
        </div>
      )}

      <UpcomingList maxRows={8} showAction={false} title="۳۰ روز آینده" />

      <Section title="همه سررسیدها">
        <ListGroup>
          <ListRow
            href="/deadlines/loans"
            leading={
              <IconBadge color="#fbbf24">
                <CalendarClock size={18} strokeWidth={1.9} />
              </IconBadge>
            }
            title="اقساط و وام‌ها"
            subtitle={
              counts.loans > 0
                ? `${n(counts.loans)} وام فعال · ${n(counts.installments)} قسط مانده`
                : 'وام یا خرید اعتباری ثبت نشده'
            }
            chevron
          />
          <ListRow
            href="/deadlines/checks"
            leading={
              <IconBadge color="#a78bfa">
                <ReceiptText size={18} strokeWidth={1.9} />
              </IconBadge>
            }
            title="چک‌ها"
            subtitle={counts.checks > 0 ? `${n(counts.checks)} چک در انتظار` : 'چک در انتظاری نداری'}
            chevron
          />
          <ListRow
            href="/deadlines/subscriptions"
            leading={
              <IconBadge color="#22d3ee">
                <Repeat size={18} strokeWidth={1.9} />
              </IconBadge>
            }
            title="اشتراک‌ها"
            subtitle={
              counts.subscriptions > 0 ? `${n(counts.subscriptions)} اشتراک فعال` : 'اشتراک فعالی نداری'
            }
            chevron
          />
          <ListRow
            href="/deadlines/persons"
            leading={
              <IconBadge color="#34d399">
                <HandCoins size={18} strokeWidth={1.9} />
              </IconBadge>
            }
            title="طلب و بدهی اشخاص"
            subtitle={counts.persons > 0 ? `${n(counts.persons)} شخص` : 'شخصی ثبت نشده'}
            chevron
          />
        </ListGroup>
      </Section>
    </Page>
  );
}
