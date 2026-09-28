'use client';

import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { pick, pnlPercent, type AssetPnl, type PnlPart } from '@/features/reports/utils/asset-pnl';

function signed(value: number, mode: CurrencyMode): string {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value, mode)}`;
}

function tone(value: number): string {
  return value >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

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
  splits?: { label: string; value: PnlPart }[];
  mode: CurrencyMode;
  emphasis?: boolean;
  note?: string | null;
}) {
  const v = value ? pick(value, mode) : null;
  return (
    <div
      className={`rounded-2xl border p-4 ${
        emphasis
          ? v !== null && v < 0
            ? 'border-rose-400/25 bg-rose-500/8'
            : 'border-emerald-400/25 bg-emerald-500/8'
          : 'border-white/5 bg-[#1A1B26]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${emphasis ? 'text-slate-200' : 'text-slate-400'}`}>
            {title}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
        </div>
        {v === null ? (
          <p className="text-sm text-amber-400/80">—</p>
        ) : (
          <div className="text-left shrink-0" dir="ltr">
            <p className={`font-black ${emphasis ? 'text-xl' : 'text-sm'} ${tone(v)}`}>
              {signed(v, mode)}
            </p>
            {percent !== null && (
              <p className={`text-[11px] font-semibold ${tone(v)} opacity-80`}>
                {percent >= 0 ? '+' : ''}
                {percent.toFixed(2)}%
              </p>
            )}
          </div>
        )}
      </div>
      {splits && splits.length > 0 && v !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-2">
          {splits.map((s) => {
            const sv = pick(s.value, mode);
            return (
              <div key={s.label} className="min-w-0">
                <p className="text-[10px] text-slate-500">{s.label}</p>
                <p className={`truncate text-xs font-bold ${tone(sv)} opacity-80`} dir="ltr">
                  {signed(sv, mode)}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {note ? <p className="mt-2 text-[10px] text-amber-400/80">{note}</p> : null}
    </div>
  );
}

/** Active (open) · this year · from the beginning — exact P/L of one asset. */
export function AssetPnlBreakdown({ pnl, mode }: { pnl: AssetPnl; mode: CurrencyMode }) {
  const hasHoldings = pnl.holdings > 0;
  const since = pnl.active.since ? toPersianDigits(pnl.active.since) : null;

  return (
    <section aria-label="سود و زیان" className="space-y-3">
      <Row
        title="سود/زیان باز (فعال)"
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
                { label: 'سرمایه‌ی این موقعیت', value: pnl.active.cost },
                {
                  label: 'ارزش فعلی',
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
        title="سود/زیان امسال"
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
        title="سود/زیان از ابتدا"
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
