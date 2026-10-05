import type { Transaction } from '@/shared/types/domain';
import { parseDateToNumber } from '@/shared/utils/parse-date';

function createdAtMs(tx: Transaction): number {
  const ms = new Date(tx.created_at).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Chronological order for replaying one asset's rows (cost basis, holdings).
 *
 * Rows are sorted by date, then by the moment they were created — the real
 * order the user did things. That matters on a day with "sell all, then buy
 * again": the sell must close the old position (reset cost to 0) BEFORE the
 * new buy opens a fresh one.
 *
 * Only when that real order is impossible — a sell would take more units
 * than held at that moment (usually a same-day buy entered after its sell) —
 * the day falls back to "acquisitions first", so no phantom oversell or
 * zero balance appears.
 *
 * `qtyOf` must return the units the replay engine will actually apply for a
 * row (0 for rows the engine skips), so this simulation matches the engine.
 */
export function orderAssetTxsForReplay(
  txs: Transaction[],
  isAcquire: (tx: Transaction) => boolean,
  qtyOf: (tx: Transaction) => number
): Transaction[] {
  const sorted = [...txs].sort((a, b) => {
    const da = parseDateToNumber(a.date_string);
    const db = parseDateToNumber(b.date_string);
    if (da !== db) return da - db;
    const ca = createdAtMs(a);
    const cb = createdAtMs(b);
    if (ca !== cb) return ca - cb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const out: Transaction[] = [];
  let held = 0;
  let i = 0;
  while (i < sorted.length) {
    const day = parseDateToNumber(sorted[i]!.date_string);
    let j = i;
    while (j < sorted.length && parseDateToNumber(sorted[j]!.date_string) === day) j += 1;
    const group = sorted.slice(i, j);

    // Can the day be replayed in the real (created) order without overselling?
    let sim = held;
    let feasible = true;
    for (const tx of group) {
      const q = qtyOf(tx);
      if (!(q > 0)) continue;
      if (isAcquire(tx)) {
        sim += q;
      } else {
        if (q > sim * (1 + 1e-9) + 1e-15) {
          feasible = false;
          break;
        }
        sim -= q;
      }
    }

    const ordered = feasible
      ? group
      : // Stable: keeps created order inside acquisitions and inside disposals.
        [...group.filter((tx) => isAcquire(tx)), ...group.filter((tx) => !isAcquire(tx))];

    for (const tx of ordered) {
      const q = qtyOf(tx);
      if (!(q > 0)) continue;
      // Net units (may go below 0: the engine carries an oversell as a short).
      held = isAcquire(tx) ? held + q : held - q;
      out.push(tx);
    }
    // Keep rows the engine skips too (it will ignore them itself).
    for (const tx of ordered) {
      if (!(qtyOf(tx) > 0)) out.push(tx);
    }
    i = j;
  }
  return out;
}
