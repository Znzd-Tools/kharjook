'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  currentPeriod,
  encodePeriodParams,
  formatPeriodLabel,
  isCurrentPeriod,
  PERIOD_KINDS,
  shiftPeriod,
  type Period,
  type PeriodKind,
  formatPeriodKindLabel,
} from '@/shared/utils/period';
import { SegmentedControl } from '@/shared/components/ui';

interface PeriodNavHeaderProps {
  period: Period;
  onChange: (next: Period) => void;
}

export function PeriodNavHeader({ period, onChange }: PeriodNavHeaderProps) {
  const onKind = (kind: PeriodKind) => {
    // When switching granularity, anchor on the current period's start so the
    // view stays centered on the same "now moment" the user was looking at.
    if (kind === period.kind) return;
    onChange(currentPeriod(kind));
  };

  const atCurrent = isCurrentPeriod(period);
  const isAllPeriod = period.kind === 'all';

  const navBtn =
    'shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 hover:bg-white/6 disabled:text-zinc-700 disabled:hover:bg-transparent transition-colors';

  return (
    <div className="space-y-2">
      <SegmentedControl
        size="sm"
        value={period.kind}
        onChange={onKind}
        options={PERIOD_KINDS.map((k) => ({ value: k, label: formatPeriodKindLabel(k) }))}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(shiftPeriod(period, -1))}
          aria-label="قبلی"
          disabled={isAllPeriod}
          className={navBtn}
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold text-zinc-100">{formatPeriodLabel(period)}</div>
          {!atCurrent && !isAllPeriod ? (
            <button
              type="button"
              onClick={() => onChange(currentPeriod(period.kind))}
              className="mt-0.5 text-[11px] text-accent-300 hover:text-accent-200"
            >
              برگشت به {formatPeriodKindLabel(period.kind)} جاری
            </button>
          ) : (
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {isAllPeriod ? 'تمام تاریخچه' : `${formatPeriodKindLabel(period.kind)} جاری`}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(shiftPeriod(period, 1))}
          aria-label="بعدی"
          disabled={isAllPeriod}
          className={navBtn}
        >
          <ChevronLeft size={18} />
        </button>
      </div>
    </div>
  );
}

// Keep the helper in scope for consumers that need to push URL state.
export function periodToSearchParams(p: Period): URLSearchParams {
  const { period, d } = encodePeriodParams(p);
  return new URLSearchParams({ period, d });
}
