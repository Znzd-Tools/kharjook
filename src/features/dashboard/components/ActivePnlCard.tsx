'use client';

import { Card, DeltaPill, ListGroup, ListRow, Money, Section, Stat } from '@/shared/components/ui';
import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatDisplayNumber } from '@/shared/utils/format-display-number';

export interface ActivePnlMover {
  id: string;
  name: string;
  /** Open P/L in the display currency. */
  value: number;
  /** Open P/L as % of this asset's open cost basis. */
  percent: number;
}

function signed(value: number, currencyMode: CurrencyMode): string {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value, currencyMode)}`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Open (active / unrealized) P/L of what you hold right now — the number you
 * can still act on — then this-year and all-time as context, then the biggest
 * movers.
 */
export function ActivePnlCard({
  currencyMode,
  openValue,
  openPercent,
  openCostBasis,
  yearValue,
  allTimeValue,
  movers,
  warning,
}: {
  currencyMode: CurrencyMode;
  openValue: number;
  openPercent: number;
  openCostBasis: number;
  yearValue: number;
  allTimeValue: number;
  movers: ActivePnlMover[];
  warning?: string | null;
}) {
  const tone = (v: number): 'positive' | 'negative' => (v >= 0 ? 'positive' : 'negative');

  return (
    <Section title="سود و زیان" action={{ label: 'دارایی‌ها', href: '/assets' }}>
      <Card className="space-y-4">
        <div>
          <p className="text-xs text-zinc-500">سود/زیان باز</p>
          {openCostBasis > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-semibold tracking-tight">
                <Money tone={tone(openValue)}>{signed(openValue, currencyMode)}</Money>
              </span>
              <DeltaPill value={openPercent}>{signedPercent(openPercent)}</DeltaPill>
            </div>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">فعلاً دارایی بازی نداری.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
          <Stat label="امسال" value={signed(yearValue, currencyMode)} tone={tone(yearValue)} />
          <Stat label="از ابتدا" value={signed(allTimeValue, currencyMode)} tone={tone(allTimeValue)} />
        </div>
        {warning ? <p className="text-[11px] leading-relaxed text-amber-400/80">{warning}</p> : null}
      </Card>

      {movers.length > 0 && (
        <ListGroup>
          {movers.map((row) => (
            <ListRow
              key={row.id}
              href={`/assets/${row.id}`}
              title={row.name}
              trailing={<Money tone={tone(row.value)}>{signed(row.value, currencyMode)}</Money>}
              trailingSub={<Money tone={tone(row.value)}>{signedPercent(row.percent)}</Money>}
              className="py-3"
            />
          ))}
        </ListGroup>
      )}
    </Section>
  );
}

export function formatMissingPriceWarning(
  missingCount: number,
  partialCount: number
): string | null {
  if (missingCount <= 0 && partialCount <= 0) return null;
  const parts: string[] = [];
  if (missingCount > 0) {
    parts.push(`${formatDisplayNumber(missingCount)} دارایی بدون قیمت تاریخی؛`);
  }
  if (partialCount > 0) {
    parts.push(`${formatDisplayNumber(partialCount)} دارایی فقط با سود محقق‌شده.`);
  }
  if (missingCount > 0) parts.push('عدد سال ممکن است ناقص باشد.');
  return parts.join(' ');
}
