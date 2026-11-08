'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Amount, Banner, Delta, SegmentedControl, cn } from '@/design-system';
import type { PnlPart } from '@/features/reports/utils/asset-pnl';
import { VIEW_HINT, VIEW_LABEL, percentOf, type PnlSummary, type PnlView } from '../utils/pnl-summary';

/**
 * Profit and loss with three equal views (P1): دوره فعلی · امسال · از ابتدا.
 * Toman and USD side by side (P4): with inflation a toman gain can be a
 * dollar loss.
 */
export function PnlCard({
  summary,
  initialView = 'active',
  href,
  className,
}: {
  summary: PnlSummary;
  initialView?: PnlView;
  /** Makes the header a link to the PnL screen. */
  href?: string;
  className?: string;
}) {
  const [view, setView] = useState<PnlView>(initialView);
  const t = summary[view];
  const pctToman = percentOf(t, 'toman');
  const pctUsd = percentOf(t, 'usd');

  return (
    <section aria-label="سود و زیان" className={cn('space-y-4 rounded-card bg-panel p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-fg">سود و زیان</h2>
        {href && (
          <Link href={`${href}?view=${view}`} className="ds-focus rounded text-caption text-accent-ink">
            جزئیات
          </Link>
        )}
      </div>

      <SegmentedControl
        aria-label="بازه سود و زیان"
        value={view}
        onValueChange={setView}
        options={(['active', 'year', 'allTime'] as PnlView[]).map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
      />

      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Amount value={t.value.toman} size="lg" tone="auto" signed compact />
          {pctToman != null && <Delta value={pctToman} pill />}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 text-caption text-fg-subtle">
          <span>به دلار:</span>
          <Amount value={t.value.usd} currency="USD" size="xs" tone="auto" signed />
          {pctUsd != null && <Delta value={pctUsd} />}
        </div>
      </div>

      {view !== 'active' && <SplitBar realized={t.realized} unrealized={t.unrealized} />}

      <p className="text-caption text-fg-subtle">{VIEW_HINT[view]}</p>

      {summary.missingPriceCount > 0 && (
        <Banner tone="warning">
          {summary.missingPriceCount.toLocaleString('fa-IR')} دارایی قیمت ندارد؛ بخش باز آن‌ها در جمع نیامده.
        </Banner>
      )}
      {view === 'year' && summary.yearPartialCount > 0 && (
        <p className="text-micro text-warning-ink">
          برای {summary.yearPartialCount.toLocaleString('fa-IR')} دارایی قیمت ابتدا یا انتهای سال نبود؛ عدد امسال ناقص است.
        </p>
      )}
      {summary.excludedCount > 0 && (
        <p className="text-micro text-fg-subtle">
          {summary.excludedCount.toLocaleString('fa-IR')} دارایی خارج از محاسبه سود و زیان است.
        </p>
      )}
    </section>
  );
}

function SplitBar({ realized, unrealized }: { realized: PnlPart; unrealized: PnlPart }) {
  const r = Math.abs(realized.toman);
  const u = Math.abs(unrealized.toman);
  const total = r + u || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        <span className="h-full rounded-s-full bg-chart-3" style={{ width: `${(r / total) * 100}%` }} />
        <span className="h-full rounded-e-full bg-chart-7" style={{ width: `${(u / total) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-caption">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-3" />
          <span className="text-fg-muted">محقق‌شده (فروش)</span>
          <Amount value={realized.toman} size="xs" compact tone="auto" signed className="ms-auto" />
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-7" />
          <span className="text-fg-muted">باز (روی کاغذ)</span>
          <Amount value={unrealized.toman} size="xs" compact tone="auto" signed className="ms-auto" />
        </span>
      </div>
    </div>
  );
}
