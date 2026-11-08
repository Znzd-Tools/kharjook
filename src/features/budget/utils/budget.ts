/**
 * Budget envelopes: pure math. Every number on the budget screen comes
 * from here (unit-tested), the UI only shows it.
 *
 *   assigned(m)  = allocation for month m, else the category cap, else 0
 *   spent(m)     = expenses of the category subtree in month m, without
 *                  sub-categories that have their own envelope
 *   carry(m)     = rollover ? available(m - 1) : 0  (from the start month)
 *   available(m) = carry(m) + assigned(m) - spent(m)
 *   unassigned   = income(m) - Σ assigned(m)
 */
import type { Category, Transaction } from '@/shared/types/domain';
import { collectDescendantCategoryIds } from '@/features/categories/utils/category-spending-caps';

export interface EnvelopeRow {
  category_id: string;
  rollover: boolean;
  created_at: string;
}
export interface AllocationRow {
  category_id: string;
  month: string;
  amount_toman: number;
}
export interface CapRow {
  category_id: string;
  monthly_limit_toman: number;
  created_at?: string;
}

export interface EnvelopeStatus {
  categoryId: string;
  name: string;
  color: string;
  rollover: boolean;
  /** Money given this month (allocation or the cap). */
  assigned: number;
  /** True when this month has its own amount (not the cap). */
  custom: boolean;
  /** Monthly default (the cap), if any. */
  monthlyDefault: number | null;
  carry: number;
  spent: number;
  available: number;
  /** Average spend of the 3 months before, for a suggestion. */
  avgSpent: number;
}

export interface BudgetMonth {
  month: string;
  income: number;
  assigned: number;
  spent: number;
  unassigned: number;
  envelopes: EnvelopeStatus[];
}

export const monthKey = (jy: number, jm: number) => `${jy}/${String(jm).padStart(2, '0')}`;

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('/').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  return monthKey(Math.floor(total / 12), (total % 12) + 1);
}

/** "1405/08/17" → "1405/08". Accepts Persian digits. */
export function monthOfDate(dateString: string): string | null {
  const latin = dateString.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const m = latin.match(/^(\d{4})\/(\d{1,2})/);
  return m ? monthKey(Number(m[1]), Number(m[2])) : null;
}

/** Month of an ISO timestamp, in Jalaali, through the given converter. */
export type IsoToMonth = (iso: string) => string;

const toman = (tx: Transaction) => {
  const v = Number(tx.amount_toman_at_time);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

export function buildBudgetMonth(input: {
  month: string;
  categories: Category[];
  transactions: Transaction[];
  caps: CapRow[];
  envelopes: EnvelopeRow[];
  allocations: AllocationRow[];
  isoToMonth: IsoToMonth;
}): BudgetMonth {
  const { month, categories, transactions, caps, envelopes, allocations, isoToMonth } = input;
  const expenseCats = new Map(categories.filter((c) => c.kind === 'expense').map((c) => [c.id, c]));
  const capBy = new Map(caps.map((c) => [c.category_id, c]));
  const envBy = new Map(envelopes.map((e) => [e.category_id, e]));
  const allocBy = new Map(allocations.map((a) => [`${a.category_id}|${a.month}`, Number(a.amount_toman)]));

  // Envelope set: explicit envelopes, every cap, and any category with money this month.
  const ids = new Set<string>();
  for (const e of envelopes) ids.add(e.category_id);
  for (const c of caps) if (Number(c.monthly_limit_toman) > 0) ids.add(c.category_id);
  for (const a of allocations) if (a.month === month) ids.add(a.category_id);
  for (const id of [...ids]) if (!expenseCats.has(id)) ids.delete(id);

  // Each expense category belongs to the nearest envelope above it (or itself).
  const owner = new Map<string, string>();
  for (const cat of expenseCats.values()) {
    let cur: string | null = cat.id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      if (ids.has(cur)) {
        owner.set(cat.id, cur);
        break;
      }
      seen.add(cur);
      cur = expenseCats.get(cur)?.parent_id ?? null;
    }
  }

  // Spend per envelope per month.
  const spentBy = new Map<string, number>();
  let income = 0;
  for (const tx of transactions) {
    const m = monthOfDate(tx.date_string);
    if (!m) continue;
    if (tx.type === 'INCOME' && m === month) income += toman(tx);
    if (tx.type !== 'EXPENSE' || !tx.category_id) continue;
    const env = owner.get(tx.category_id);
    if (!env) continue;
    const key = `${env}|${m}`;
    spentBy.set(key, (spentBy.get(key) ?? 0) + toman(tx));
  }

  const assignedFor = (id: string, m: string) => {
    const a = allocBy.get(`${id}|${m}`);
    if (a !== undefined) return a;
    const cap = Number(capBy.get(id)?.monthly_limit_toman);
    return Number.isFinite(cap) && cap > 0 ? cap : 0;
  };

  const rows: EnvelopeStatus[] = [];
  for (const id of ids) {
    const cat = expenseCats.get(id)!;
    const env = envBy.get(id);
    const rollover = env?.rollover ?? false;
    const createdIso = env?.created_at ?? capBy.get(id)?.created_at;
    const firstAlloc = allocations.filter((a) => a.category_id === id).map((a) => a.month).sort()[0];
    const created = createdIso ? isoToMonth(createdIso) : month;
    const start = [created, firstAlloc ?? created].sort()[0]!;

    let carry = 0;
    if (rollover && start < month) {
      // Walk from the start month (at most 24 months back).
      let m = start < shiftMonth(month, -24) ? shiftMonth(month, -24) : start;
      let avail = 0;
      while (m < month) {
        avail = avail + assignedFor(id, m) - (spentBy.get(`${id}|${m}`) ?? 0);
        m = shiftMonth(m, 1);
      }
      carry = avail;
    }
    const assigned = assignedFor(id, month);
    const spent = spentBy.get(`${id}|${month}`) ?? 0;
    const prev = [1, 2, 3].map((d) => spentBy.get(`${id}|${shiftMonth(month, -d)}`) ?? 0);
    const cap = Number(capBy.get(id)?.monthly_limit_toman);
    rows.push({
      categoryId: id,
      name: cat.name,
      color: cat.color,
      rollover,
      assigned,
      custom: allocBy.has(`${id}|${month}`),
      monthlyDefault: Number.isFinite(cap) && cap > 0 ? cap : null,
      carry,
      spent,
      available: carry + assigned - spent,
      avgSpent: Math.round(prev.reduce((s, v) => s + v, 0) / 3),
    });
  }
  rows.sort((a, b) => a.available - b.available || a.name.localeCompare(b.name, 'fa'));

  const assigned = rows.reduce((s, r) => s + r.assigned, 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  return { month, income, assigned, spent, unassigned: income - assigned, envelopes: rows };
}

/** Allocation rows to write for "move x from A to B" in a month. */
export function planMove(
  month: string,
  from: Pick<EnvelopeStatus, 'categoryId' | 'assigned' | 'available'>,
  to: Pick<EnvelopeStatus, 'categoryId' | 'assigned'>,
  amount: number
): { ok: true; rows: AllocationRow[] } | { ok: false; error: string } {
  if (!(amount > 0)) return { ok: false, error: 'مبلغ را وارد کن' };
  if (from.categoryId === to.categoryId) return { ok: false, error: 'دو پاکت متفاوت انتخاب کن' };
  if (amount > Math.max(from.available, 0)) return { ok: false, error: 'این پاکت این‌قدر پول ندارد' };
  return {
    ok: true,
    rows: [
      { category_id: from.categoryId, month, amount_toman: from.assigned - amount },
      { category_id: to.categoryId, month, amount_toman: to.assigned + amount },
    ],
  };
}

export { collectDescendantCategoryIds };
