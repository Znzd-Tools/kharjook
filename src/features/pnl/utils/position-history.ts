/**
 * Position history of one asset (UX plan P3): every period between two
 * "holding = 0" points. Uses calculateAssetStats at the end of each
 * trading day, so the numbers come from the same math as everywhere else.
 */
import type { Asset, Transaction } from '@/shared/types/domain';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';

export interface PositionPeriod {
  start: string;
  /** Date the holding reached 0; null = still open. */
  end: string | null;
  realizedToman: number;
  realizedUsd: number;
  /** Open part (only for the current, still-open position). */
  unrealizedToman: number;
  unrealizedUsd: number;
}

const touches = (tx: Transaction, id: string) =>
  tx.asset_id === id || tx.source_asset_id === id || tx.target_asset_id === id;

export function positionHistory(asset: Asset, transactions: Transaction[], usdRate: number): PositionPeriod[] {
  const own = transactions.filter((t) => touches(t, asset.id));
  const dates = [...new Set(own.map((t) => t.date_string))].sort();
  const out: PositionPeriod[] = [];
  let prevRealT = 0;
  let prevRealU = 0;
  let open: { start: string } | null = null;

  for (const d of dates) {
    const s = calculateAssetStats(asset, own.filter((t) => t.date_string <= d), 'TOMAN', usdRate);
    const held = s.totalAmount > 0;
    const sinceChanged = open && held && s.activeSinceDate && s.activeSinceDate !== open.start;
    if (open && (!held || sinceChanged)) {
      out.push({
        start: open.start,
        end: d,
        realizedToman: s.realizedProfitToman - prevRealT,
        realizedUsd: s.realizedProfitUsd - prevRealU,
        unrealizedToman: 0,
        unrealizedUsd: 0,
      });
      prevRealT = s.realizedProfitToman;
      prevRealU = s.realizedProfitUsd;
      open = null;
    }
    if (held && !open) open = { start: s.activeSinceDate ?? d };
  }

  if (open) {
    const s = calculateAssetStats(asset, own, 'TOMAN', usdRate);
    out.push({
      start: open.start,
      end: null,
      realizedToman: s.realizedProfitToman - prevRealT,
      realizedUsd: s.realizedProfitUsd - prevRealU,
      unrealizedToman: s.unrealizedProfitToman,
      unrealizedUsd: s.unrealizedProfitUsd,
    });
  }
  return out.reverse(); // newest first
}
