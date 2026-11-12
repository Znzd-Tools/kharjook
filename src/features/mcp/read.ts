/**
 * MCP read tools. Pure over a loaded Book, using the same functions as the
 * app screens, so Claude sees exactly the numbers the app shows.
 */
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import { personCurrency } from '@/shared/utils/person-currency';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { formatJalaali, jalaaliOfDate, todayJalaali } from '@/shared/utils/jalali';
import { buildPnlSummary, percentOf } from '@/features/pnl/utils/pnl-summary';
import { buildGoalDriftRows } from '@/features/goals/utils/goal-drift-rows';
import { isGoalMet } from '@/features/goals/utils/goal-progress-display';
import { validateGoalSet } from '@/features/goals/utils/goal-validation';
import { buildTimeline } from '@/features/deadlines/utils/timeline';
import { describeTransaction } from '@/features/transactions/utils/describe-transaction';
import { buildBudgetMonth, monthKey } from '@/features/budget/utils/budget';
import type { Book } from './book';

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;
const today = () => formatJalaali(todayJalaali());
const norm = (d: string) => d.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));

function holdings(book: Book) {
  return book.assets
    .map((asset) => {
      const st = calculateAssetStats(asset, book.transactions, 'TOMAN', book.usdRate);
      return { asset, st };
    })
    .filter(({ st }) => st.totalAmount > 0);
}

function cashToman(book: Book) {
  return book.wallets.reduce((s, w) => s + calculateWalletStats(w, book.transactions).balance * tomanPerUnit(w.currency, book.currencyRates), 0);
}

export function getOverview(book: Book) {
  const hs = holdings(book).filter(({ asset }) => asset.include_in_balance !== false);
  const assetsToman = hs.reduce((s, h) => s + h.st.currentValueToman, 0);
  const cash = cashToman(book);
  const total = assetsToman + cash;
  const groupName = (id: string | null) => book.categories.find((c) => c.id === id)?.name ?? 'بدون گروه';
  const byGroup = new Map<string, number>();
  for (const h of hs) byGroup.set(groupName(h.asset.category_id), (byGroup.get(groupName(h.asset.category_id)) ?? 0) + h.st.currentValueToman);
  const pnl = buildPnlSummary(book.assets, book.transactions, book.dailyPrices, book.usdRate, today());
  const goals = buildGoalDriftRows({ goals: book.goals, assets: book.assets, categories: book.categories, transactions: book.transactions, currencyMode: 'TOMAN', usdRate: book.usdRate });
  const view = (k: 'active' | 'year' | 'allTime') => ({
    toman: r0(pnl[k].value.toman),
    usd: r2(pnl[k].value.usd),
    percent_toman: percentOf(pnl[k], 'toman'),
    percent_usd: percentOf(pnl[k], 'usd'),
  });
  return {
    date: today(),
    usd_rate_toman: book.usdRate,
    net_worth: { toman: r0(total), usd: book.usdRate ? r2(total / book.usdRate) : null },
    cash_toman: r0(cash),
    assets_toman: r0(assetsToman),
    allocation_by_group: [...byGroup.entries()]
      .map(([group, v]) => ({ group, toman: r0(v), share_percent: total ? r2((v / total) * 100) : 0 }))
      .concat([{ group: 'نقد (کیف پول‌ها)', toman: r0(cash), share_percent: total ? r2((cash / total) * 100) : 0 }])
      .sort((a, b) => b.toman - a.toman),
    profit: {
      note: 'active = open positions since the last time each was zero; year = this Jalali year; allTime = everything. usd = measured in dollars (the real profit in Iran).',
      active: view('active'),
      year: view('year'),
      allTime: view('allTime'),
    },
    goals: { total: goals.length, on_target: goals.filter((g) => isGoalMet(g.currentValue, g.targetValue, g.valueKind)).length },
    assets_without_price: pnl.missingPriceCount,
  };
}

export function getAssets(book: Book) {
  const pnl = buildPnlSummary(book.assets, book.transactions, book.dailyPrices, book.usdRate, today());
  const byId = new Map(pnl.rows.map((r) => [r.asset.id, r.pnl]));
  const hs = holdings(book);
  const total = hs.filter((h) => h.asset.include_in_balance !== false).reduce((s, h) => s + h.st.currentValueToman, 0) + cashToman(book);
  return hs
    .map(({ asset, st }) => {
      const p = byId.get(asset.id);
      return {
        id: asset.id,
        name: asset.name,
        group: book.categories.find((c) => c.id === asset.category_id)?.name ?? null,
        unit: asset.unit,
        quantity: st.totalAmount,
        price_toman: asset.price_toman,
        price_usd: asset.price_usd,
        value_toman: r0(st.currentValueToman),
        value_usd: r2(st.currentValueUsd),
        share_of_net_worth_percent: total ? r2((st.currentValueToman / total) * 100) : 0,
        avg_buy_price_toman: r0(st.avgBuyPriceToman),
        profit: p
          ? {
              active_toman: r0(p.active.value.toman),
              active_usd: r2(p.active.value.usd),
              year_toman: r0(p.year.value.toman),
              year_usd: r2(p.year.value.usd),
              all_time_toman: r0(p.allTime.value.toman),
              all_time_usd: r2(p.allTime.value.usd),
            }
          : null,
        counted_in_profit: asset.include_in_profit_loss !== false,
        counted_in_net_worth: asset.include_in_balance !== false,
      };
    })
    .sort((a, b) => b.value_toman - a.value_toman);
}

export function getGoals(book: Book) {
  const rows = buildGoalDriftRows({ goals: book.goals, assets: book.assets, categories: book.categories, transactions: book.transactions, currencyMode: 'TOMAN', usdRate: book.usdRate });
  return {
    goals: rows.map((r) => {
      const g = book.goals.find((x) => x.id === r.id)!;
      return {
        id: r.id,
        name: r.name,
        scope: g.scope,
        kind: g.target_kind,
        current: r2(r.currentValue),
        target: r2(r.targetValue),
        unit: r.valueKind === 'percent' ? '% of net worth' : book.assets.find((a) => a.id === g.asset_id)?.unit ?? '',
        on_target: isGoalMet(r.currentValue, r.targetValue, r.valueKind),
        gap: r.deltaLabel,
        suggested_action: r.actionSuggestion,
      };
    }),
    rule_problems: validateGoalSet(book.goals, book.assets, book.categories),
  };
}

export function listTransactions(
  book: Book,
  f: { from?: string; to?: string; type?: string; category_id?: string; wallet_id?: string; asset_id?: string; text?: string; limit?: number }
) {
  const lookup = { wallets: book.wallets, assets: book.assets, persons: book.persons, categories: book.categories };
  const rows = book.transactions
    .filter((t) => (!f.from || norm(t.date_string) >= f.from) && (!f.to || norm(t.date_string) <= f.to))
    .filter((t) => !f.type || t.type === f.type)
    .filter((t) => !f.category_id || t.category_id === f.category_id)
    .filter((t) => !f.wallet_id || t.source_wallet_id === f.wallet_id || t.target_wallet_id === f.wallet_id)
    .filter((t) => !f.asset_id || t.source_asset_id === f.asset_id || t.target_asset_id === f.asset_id)
    .filter((t) => !f.text || (t.note ?? '').includes(f.text) || describeTransaction(t, lookup).title.includes(f.text))
    .sort((a, b) => norm(b.date_string).localeCompare(norm(a.date_string)) || b.created_at.localeCompare(a.created_at));
  const limit = Math.min(f.limit ?? 50, 300);
  return {
    total_matching: rows.length,
    rows: rows.slice(0, limit).map((t) => {
      const d = describeTransaction(t, lookup);
      return {
        id: t.id,
        date: norm(t.date_string),
        type: t.type,
        title: d.title,
        detail: d.subtitle,
        amount: t.type === 'TRANSFER' || t.type === 'EXPENSE' || t.type === 'BUY' ? Number(t.source_amount) : Number(t.target_amount),
        unit: typeof d.unit === 'string' ? d.unit : d.unit.asset,
        toman_at_time: t.amount_toman_at_time,
        category: d.categoryName,
        note: t.note,
      };
    }),
  };
}

export function getCashflow(book: Book, from: string, to: string) {
  let income = 0;
  let expense = 0;
  let unpriced = 0;
  const byCat = new Map<string, { kind: 'income' | 'expense'; toman: number }>();
  const name = (id: string | null) => book.categories.find((c) => c.id === id)?.name ?? 'بدون دسته';
  for (const t of book.transactions) {
    const d = norm(t.date_string);
    if (d < from || d > to || (t.type !== 'INCOME' && t.type !== 'EXPENSE')) continue;
    const v = Number(t.amount_toman_at_time);
    if (!Number.isFinite(v) || t.amount_toman_at_time == null) {
      unpriced++;
      continue;
    }
    if (t.type === 'INCOME') income += v;
    else expense += v;
    const k = `${t.type}|${name(t.category_id)}`;
    const cur = byCat.get(k) ?? { kind: t.type === 'INCOME' ? 'income' : 'expense', toman: 0 };
    cur.toman += v;
    byCat.set(k, cur);
  }
  return {
    from,
    to,
    income_toman: r0(income),
    expense_toman: r0(expense),
    net_toman: r0(income - expense),
    savings_rate_percent: income > 0 ? r2(((income - expense) / income) * 100) : null,
    by_category: [...byCat.entries()].map(([k, v]) => ({ category: k.split('|')[1], kind: v.kind, toman: r0(v.toman) })).sort((a, b) => b.toman - a.toman),
    rows_without_toman_value: unpriced,
  };
}

export function getUpcoming(book: Book, days: number) {
  const loanBy = new Map(book.loans.map((l) => [l.id, l]));
  const items = buildTimeline(
    {
      checks: book.checks,
      subscriptions: book.subscriptions.filter((s) => s.status === 'active'),
      installments: book.installments
        .filter((i) => !i.is_paid && loanBy.has(i.loan_id))
        .map((i) => {
          const l = loanBy.get(i.loan_id)!;
          return { ...i, loanTitle: l.title, loanCurrency: l.currency, loanAssetId: l.asset_id, loanWalletId: l.auto_income_wallet_id };
        }),
    },
    todayJalaali()
  );
  return items
    .filter((i) => i.daysLeft <= days)
    .map((i) => ({
      kind: i.kind,
      id: i.id,
      title: i.title,
      due: i.due,
      days_left: i.daysLeft,
      amount: i.amount,
      currency: i.assetId ? book.assets.find((a) => a.id === i.assetId)?.unit ?? 'asset' : i.currency,
      amount_toman: i.assetId ? null : r0(i.amount * tomanPerUnit(i.currency, book.currencyRates)),
      default_wallet_id: i.walletId,
    }));
}

export function getBudget(book: Book, month?: string) {
  const t = todayJalaali();
  const m = month ?? monthKey(t.jy, t.jm);
  const isoToMonth = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '0000/00';
    const j = jalaaliOfDate(d);
    return monthKey(j.jy, j.jm);
  };
  const b = buildBudgetMonth({ month: m, categories: book.categories, transactions: book.transactions, caps: book.caps, envelopes: book.envelopes, allocations: book.allocations, isoToMonth });
  return {
    month: m,
    income_toman: r0(b.income),
    assigned_toman: r0(b.assigned),
    spent_toman: r0(b.spent),
    unassigned_toman: r0(b.unassigned),
    envelopes: b.envelopes.map((e) => ({ category_id: e.categoryId, name: e.name, assigned: r0(e.assigned), carry: r0(e.carry), spent: r0(e.spent), available: r0(e.available), rollover: e.rollover })),
  };
}

export function getReference(book: Book) {
  return {
    wallets: book.wallets.map((w) => ({ id: w.id, name: w.name, currency: w.currency, balance: r2(calculateWalletStats(w, book.transactions).balance) })),
    assets: book.assets.map((a) => ({ id: a.id, name: a.name, unit: a.unit, group_id: a.category_id })),
    categories: book.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parent_id: c.parent_id })),
    persons: book.persons.map((p) => ({
      id: p.id,
      name: p.name,
      currency: personCurrency(p),
      /** > 0: owes the user; < 0: the user owes. In the person's currency. */
      balance: calculatePersonBalance(p, book.transactions),
    })),
  };
}
