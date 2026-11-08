/**
 * Golden (characterization) tests. They freeze what the money logic
 * returns TODAY on a fixed ledger. A changed snapshot = changed numbers
 * on screen. Never update a snapshot to "make it pass" without a written
 * reason in the commit message.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { calculateWalletStats, walletBalanceThroughDate } from '@/shared/utils/calculate-wallet-balance';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import { computeAssetPnl } from '@/features/reports/utils/asset-pnl';
import { computeYtdUnrealizedSummary } from '@/features/reports/utils/ytd-unrealized';
import { buildYearCashflowByMonth } from '@/features/dashboard/utils/year-cashflow';
import { portfolioTotalTomanAtDate } from '@/features/dashboard/utils/portfolio-history';
import { buildAssetSnapshots, calculateAssetGoalProgress, calculateGroupGoalProgress } from '@/features/goals/utils/goal-progress';
import { buildCapStatuses } from '@/features/categories/utils/category-spending-caps';
import { rollupCategories } from '@/features/reports/utils/category-rollup';
import {
  PINNED_NOW, TODAY, USD_RATE, assets, categories, currencyRates, dailyPrices, goals, persons, transactions, wallets,
} from './ledger.fixture';

const round = (v: unknown): unknown => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : String(v);
  if (Array.isArray(v)) return v.map(round);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]));
  return v;
};
const snap = (name: string, value: unknown) =>
  expect(JSON.stringify(round(value), null, 2)).toMatchFileSnapshot(`./__golden__/${name}.json`);

const month = { kind: 'month', start: { jy: 1405, jm: 8, jd: 1 }, end: { jy: 1405, jm: 8, jd: 30 } } as const;

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_NOW);
});
afterAll(() => vi.useRealTimers());

describe('golden: money logic', () => {
  it('asset stats (toman and USD)', async () => {
    const out = assets.map((a) => ({
      id: a.id,
      toman: calculateAssetStats(a, transactions, 'TOMAN', USD_RATE),
      usd: calculateAssetStats(a, transactions, 'USD', USD_RATE),
    }));
    await snap('asset-stats', out);
  });

  it('asset PnL (open, year, all-time)', async () => {
    await snap('asset-pnl', assets.map((a) => ({ id: a.id, pnl: computeAssetPnl(a, transactions, dailyPrices, USD_RATE, TODAY) })));
  });

  it('year PnL summary', async () => {
    await snap('ytd-summary', computeYtdUnrealizedSummary(assets, transactions, dailyPrices, USD_RATE, TODAY));
  });

  it('wallet balances', async () => {
    await snap('wallets', wallets.map((w) => ({
      id: w.id,
      stats: calculateWalletStats(w, transactions),
      endOf1405_07: walletBalanceThroughDate(w, transactions, '1405/07/30'),
    })));
  });

  it('person balances', async () => {
    await snap('persons', persons.map((p) => ({ id: p.id, balance: calculatePersonBalance(p, transactions) })));
  });

  it('year cashflow by month (toman and USD)', async () => {
    await snap('year-cashflow', {
      toman: buildYearCashflowByMonth(transactions, wallets, currencyRates, 'TOMAN', USD_RATE),
      usd: buildYearCashflowByMonth(transactions, wallets, currencyRates, 'USD', USD_RATE),
    });
  });

  it('portfolio total at dates', async () => {
    await snap('portfolio-total', ['1404/12/29', '1405/06/31', TODAY].map((d) => ({
      date: d,
      total: portfolioTotalTomanAtDate(assets, transactions, wallets, dailyPrices, currencyRates, TODAY, d),
    })));
  });

  it('goal progress', async () => {
    const snaps = buildAssetSnapshots(assets, transactions, 'TOMAN', USD_RATE);
    await snap('goals', goals.map((g) => ({
      id: g.id,
      progress: g.scope === 'asset_group' ? calculateGroupGoalProgress(g, snaps) : calculateAssetGoalProgress(g, snaps),
    })));
  });

  it('spending caps', async () => {
    await snap('caps', buildCapStatuses({
      caps: [
        { category_id: 'c-food', monthly_limit_toman: 5_000_000 },
        { category_id: 'c-rent', monthly_limit_toman: 12_000_000 },
        { category_id: 'c-cafe', monthly_limit_toman: 1_000_000 },
      ],
      categories,
      transactions,
      period: month as never,
    }));
  });

  it('category rollup (expense, this month)', async () => {
    await snap('rollup', rollupCategories({ transactions, categories, period: month as never, kind: 'expense', walletId: null, currencyMode: 'TOMAN' } as never));
  });
});
