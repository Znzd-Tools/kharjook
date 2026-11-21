'use client';

import { Amount, Delta, Text, cn } from '@/design-system';
import type { CurrencyMode } from '@/shared/types/domain';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { pick, pnlPercent, type AssetPnl, type PnlPart } from '@/features/reports/utils/asset-pnl';

function Row({
  title,
  hint,
  value,
  percent,
  splits,
  mode,
  emphasis = false,
  note,
}: {
  title: string;
  hint: string;
  value: PnlPart | null;
  percent: number | null;
  splits?: { label: string; value: PnlPart; plain?: boolean }[];
  mode: CurrencyMode;
  emphasis?: boolean;
  note?: string | null;
}) {
  const v = value ? pick(value, mode) : null;
  return (
    <div
      className={cn(
        'rounded-card p-4',
        emphasis ? (v !== null && v < 0 ? 'bg-negative-soft' : 'bg-positive-soft') : 'bg-panel'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Text variant="callout" weight="semibold">
            {title}
          </Text>
          <Text variant="caption" tone="subtle">
            {hint}
          </Text>
        </div>
        {v === null ? (
          <Text tone="warning">—</Text>
        ) : (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Amount value={v} currency={mode} size={emphasis ? 'lg' : 'md'} signed tone="auto" compact />
            {percent !== null && <Delta value={percent} />}
          </div>
        )}
      </div>
      {splits && splits.length > 0 && v !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-2">
          {splits.map((s) => (
            <div key={s.label} className="min-w-0">
              <Text variant="micro" tone="subtle" className="block">
                {s.label}
              </Text>
              {/* Capital and value are plain amounts; realized/open are profit (signed). */}
              <Amount value={pick(s.value, mode)} currency={mode} size="xs" signed={!s.plain} tone={s.plain ? 'default' : 'auto'} compact />
            </div>
          ))}
        </div>
      )}
      {note ? (
        <Text variant="caption" tone="warning" className="mt-2">
          {note}
        </Text>
      ) : null}
    </div>
  );
}

/** Active (open) · this year · from the beginning — exact P/L of one asset. */
export function AssetPnlBreakdown({ pnl, mode }: { pnl: AssetPnl; mode: CurrencyMode }) {
  const hasHoldings = pnl.holdings > 0;
  const since = pnl.active.since ? toPersianDigits(pnl.active.since) : null;

  return (
    <section aria-label="سود و زیان" className="space-y-2">
      <Row
        title="سود و زیان باز"
        hint={
          hasHoldings
            ? `روی واحدهایی که الان داری${since ? ` · از ${since}` : ''}`
            : 'الان واحدی نداری'
        }
        value={hasHoldings && pnl.active.available ? pnl.active.value : hasHoldings ? null : { toman: 0, usd: 0 }}
        percent={hasHoldings ? pnlPercent(pnl.active.value, pnl.active.cost, mode) : null}
        splits={
          hasHoldings
            ? [
                { label: 'سرمایه‌ی این موقعیت', value: pnl.active.cost, plain: true },
                {
                  label: 'ارزش فعلی',
                  plain: true,
                  value: {
                    toman: pnl.active.cost.toman + pnl.active.value.toman,
                    usd: pnl.active.cost.usd + pnl.active.value.usd,
                  },
                },
              ]
            : undefined
        }
        mode={mode}
        emphasis
        note={hasHoldings && !pnl.active.available ? 'قیمتی برای این دارایی ثبت نشده.' : null}
      />
      <Row
        title="سود و زیان امسال"
        hint="از ۱ فروردین تا امروز · موجودی اول سال با قیمت پایان سال قبل"
        value={pnl.year.empty ? { toman: 0, usd: 0 } : pnl.year.value}
        percent={pnlPercent(pnl.year.value, pnl.year.base, mode)}
        splits={[
          { label: 'محقق‌شده امسال', value: pnl.year.realized },
          { label: 'باز امسال', value: pnl.year.open },
        ]}
        mode={mode}
        note={pnl.year.partial ? 'قیمت اول یا آخر سال پیدا نشد؛ این عدد کامل نیست.' : null}
      />
      <Row
        title="سود و زیان از ابتدا"
        hint="همه‌ی خریدها و فروش‌ها + ارزش فعلی"
        value={pnl.allTime.value}
        percent={pnlPercent(pnl.allTime.value, pnl.allTime.invested, mode)}
        splits={[
          { label: 'محقق‌شده', value: pnl.allTime.realized },
          { label: 'باز', value: pnl.allTime.open },
        ]}
        mode={mode}
      />
    </section>
  );
}
