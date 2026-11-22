/**
 * Portfolio plan: real (USD) returns, a rebalance plan from the user's goals,
 * and risk warnings. Pure, no I/O.
 *
 * Returns are in USD on purpose: in Toman almost everything "grows" because
 * the Toman loses value. A USD return shows if an asset really made money.
 */
import type { Asset, Category, Goal } from '@/shared/types/domain';

export interface HoldingRow {
  asset: Asset;
  quantity: number;
  valueToman: number;
  /** Price per unit in USD now. */
  priceUsdNow: number;
  /** Price per unit in USD at past points; null = no price then. */
  priceUsdAt: { m3: number | null; m6: number | null; m12: number | null };
}

export interface ScoreRow {
  assetId: string;
  name: string;
  unit: string;
  valueToman: number;
  /** Share of the investment portfolio (percent). */
  sharePct: number;
  /** USD price change in percent; null = no old price. */
  usd: { m3: number | null; m6: number | null; m12: number | null };
}

const change = (now: number, then: number | null) => (then && then > 0 && now > 0 ? (now / then - 1) * 100 : null);

export function buildScorecard(rows: HoldingRow[]): ScoreRow[] {
  const total = rows.reduce((s, r) => s + r.valueToman, 0);
  return rows
    .filter((r) => r.quantity > 0 && r.valueToman > 0)
    .map((r) => ({
      assetId: r.asset.id,
      name: r.asset.name,
      unit: r.asset.unit,
      valueToman: r.valueToman,
      sharePct: total > 0 ? (r.valueToman / total) * 100 : 0,
      usd: { m3: change(r.priceUsdNow, r.priceUsdAt.m3), m6: change(r.priceUsdNow, r.priceUsdAt.m6), m12: change(r.priceUsdNow, r.priceUsdAt.m12) },
    }))
    .sort((a, b) => b.valueToman - a.valueToman);
}

/** One goal target: an asset or an asset group, as a share of the portfolio. */
interface Bucket {
  key: string;
  label: string;
  targetPct: number;
  currentToman: number;
  /** Asset to buy / sell for this bucket (the biggest one in a group). */
  asset: Asset | null;
}

export interface RebalanceAction {
  key: string;
  label: string;
  kind: 'buy' | 'sell';
  toman: number;
  /** Units of `asset` at its price; null when no asset/price. */
  units: number | null;
  asset: Asset | null;
  /** For groups: the asset suggested inside the group. */
  via: string | null;
}

export interface RebalancePlan {
  actions: RebalanceAction[];
  /** New money left (no goal wants more): stays as cash. */
  leftoverToman: number;
  /** Sum of target percents (over 100 = goals conflict). */
  targetSumPct: number;
  /** No allocation goals: nothing to plan from. */
  noGoals: boolean;
}

/**
 * Allocation goals → buckets. Asset goals win over group goals for their
 * asset (the asset's value is taken out of its group).
 */
function buckets(rows: HoldingRow[], goals: Goal[], categories: Category[]): Bucket[] {
  const out: Bucket[] = [];
  const assetGoalIds = new Set<string>();
  for (const g of goals) {
    if (g.scope !== 'asset' || g.target_kind !== 'allocation_percent' || !g.asset_id || !(Number(g.target_percent) > 0)) continue;
    const r = rows.find((x) => x.asset.id === g.asset_id);
    if (!r) continue;
    assetGoalIds.add(g.asset_id);
    out.push({ key: `a:${g.asset_id}`, label: r.asset.name, targetPct: Number(g.target_percent), currentToman: r.valueToman, asset: r.asset });
  }
  // Sets: their assets leave their groups (an asset counts in one bucket).
  const inSet = new Set<string>();
  for (const g of goals) {
    if (g.scope !== 'basket' || !(Number(g.target_percent) > 0)) continue;
    const ids = new Set(g.asset_ids ?? []);
    const members = rows.filter((x) => ids.has(x.asset.id) && !assetGoalIds.has(x.asset.id));
    members.forEach((m) => inSet.add(m.asset.id));
    const biggest = [...members].sort((a, b) => b.valueToman - a.valueToman)[0];
    out.push({
      key: `g:set:${g.id}`,
      label: g.name?.trim() || 'مجموعه',
      targetPct: Number(g.target_percent),
      currentToman: members.reduce((s, m) => s + m.valueToman, 0),
      asset: biggest?.asset ?? null,
    });
  }
  for (const g of goals) {
    if (g.scope !== 'asset_group' || !g.category_id || !(Number(g.target_percent) > 0)) continue;
    const members = rows.filter((x) => x.asset.category_id === g.category_id && !assetGoalIds.has(x.asset.id) && !inSet.has(x.asset.id));
    const biggest = [...members].sort((a, b) => b.valueToman - a.valueToman)[0];
    out.push({
      key: `g:${g.category_id}`,
      label: categories.find((c) => c.id === g.category_id)?.name ?? 'گروه',
      targetPct: Number(g.target_percent),
      currentToman: members.reduce((s, m) => s + m.valueToman, 0),
      asset: biggest?.asset ?? null,
    });
  }
  return out;
}

export function buildRebalance(input: {
  rows: HoldingRow[];
  goals: Goal[];
  categories: Category[];
  newCashToman: number;
  allowSell: boolean;
}): RebalancePlan {
  const { rows, goals, categories, allowSell } = input;
  const cash = Math.max(0, input.newCashToman);
  const bs = buckets(rows, goals, categories);
  const targetSumPct = bs.reduce((s, b) => s + b.targetPct, 0);
  if (bs.length === 0) return { actions: [], leftoverToman: cash, targetSumPct: 0, noGoals: true };

  const total = rows.reduce((s, r) => s + r.valueToman, 0) + cash;
  const gaps = bs.map((b) => ({ b, gap: (b.targetPct / 100) * total - b.currentToman }));
  const toUnits = (b: Bucket, toman: number) => {
    const price = Number(b.asset?.price_toman ?? 0);
    return b.asset && price > 0 ? toman / price : null;
  };
  const action = (b: Bucket, kind: 'buy' | 'sell', toman: number): RebalanceAction => ({
    key: b.key,
    label: b.label,
    kind,
    toman,
    units: toUnits(b, toman),
    asset: b.asset,
    via: b.key.startsWith('g:') && b.asset ? b.asset.name : null,
  });

  const actions: RebalanceAction[] = [];
  let budget = cash;
  if (allowSell) {
    for (const { b, gap } of gaps) {
      if (gap < -1) {
        actions.push(action(b, 'sell', -gap));
        budget += -gap;
      }
    }
  }
  const wants = gaps.filter((g) => g.gap > 1);
  const need = wants.reduce((s, g) => s + g.gap, 0);
  // Not enough money for every gap: share it by gap size.
  const scale = need > budget && need > 0 ? budget / need : 1;
  for (const { b, gap } of wants) {
    const toman = gap * scale;
    if (toman > 1) actions.push(action(b, 'buy', toman));
  }
  const spent = actions.filter((a) => a.kind === 'buy').reduce((s, a) => s + a.toman, 0);
  return {
    actions: actions.sort((a, b) => (a.kind === b.kind ? b.toman - a.toman : a.kind === 'sell' ? -1 : 1)),
    leftoverToman: Math.max(0, budget - spent),
    targetSumPct,
    noGoals: false,
  };
}

export interface RiskWarning {
  key: string;
  tone: 'warning' | 'negative' | 'info';
  title: string;
  text: string;
}

export function portfolioRisks(input: {
  score: ScoreRow[];
  groupShares: { name: string; sharePct: number }[];
  cashToman: number;
  avgMonthlySpending: number;
  fxDebtToman: number;
  usdLikeAssetsToman: number;
  hasGoals: boolean;
}): RiskWarning[] {
  const out: RiskWarning[] = [];
  for (const r of input.score) {
    if (r.sharePct > 40) {
      out.push({
        key: `conc:${r.assetId}`,
        tone: 'warning',
        title: `${Math.round(r.sharePct)}٪ سبد در ${r.name}`,
        text: 'یک دارایی بیشتر از ۴۰٪ سبد است. اگر قیمتش بریزد، بیشتر سبد با آن می‌ریزد.',
      });
    }
  }
  for (const g of input.groupShares) {
    if (g.sharePct >= 65) {
      out.push({ key: `grp:${g.name}`, tone: 'info', title: `${Math.round(g.sharePct)}٪ سبد در گروه ${g.name}`, text: 'تنوع سبد کم است.' });
    }
  }
  if (input.avgMonthlySpending > 0) {
    const months = input.cashToman / input.avgMonthlySpending;
    if (months < 1) {
      out.push({
        key: 'cash-low',
        tone: 'negative',
        title: 'پول نقد کمتر از یک ماه خرج',
        text: 'برای خرج‌های پیش‌بینی‌نشده ذخیره‌ی کافی نداری. قبل از خرید دارایی، نقد کنار بگذار.',
      });
    } else if (months > 6) {
      out.push({
        key: 'cash-idle',
        tone: 'info',
        title: `نقد بیش از ${Math.floor(months)} ماه خرج`,
        text: 'پول نقد زیادی بیکار است و با تورم ارزشش کم می‌شود. بخشی را طبق اهدافت سرمایه‌گذاری کن.',
      });
    }
  }
  if (input.fxDebtToman > 0 && input.fxDebtToman > input.usdLikeAssetsToman) {
    out.push({
      key: 'fx-debt',
      tone: 'negative',
      title: 'بدهی ارزی بیشتر از دارایی ارزی',
      text: 'بدهی دلاری/تتری داری که دارایی ارزی هم‌اندازه‌اش را نداری. اگر دلار بالا برود، بدهی‌ات به تومان بزرگ‌تر می‌شود.',
    });
  }
  if (!input.hasGoals) {
    out.push({ key: 'no-goals', tone: 'info', title: 'هدف تخصیص نداری', text: 'بدون هدف، برنامه‌ی خرید ساخته نمی‌شود. برای هر دارایی یا گروه درصد هدف بگذار.' });
  }
  return out;
}
