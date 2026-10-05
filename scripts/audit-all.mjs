// Read-only audit of every wallet and asset.  Usage: node --env-file=.env scripts/audit-all.mjs
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };
async function getAll(p) { const o = []; for (let f = 0; ; f += 1000) { const r = await fetch(`${U}/rest/v1/${p}`, { headers: { ...H, Range: `${f}-${f + 999}` } }); if (!r.ok) throw new Error(await r.text()); const j = await r.json(); o.push(...j); if (j.length < 1000) return o; } }
const lat = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const dnum = (s) => { const p = lat(s).split(/[-/_\s]/); return p.length >= 3 ? +(p[0] + p[1].padStart(2, '0') + p[2].padStart(2, '0')) : 0; };
const ms = (t) => new Date(t.created_at).getTime() || 0;
const byDate = (a, b) => dnum(a.date_string) - dnum(b.date_string) || ms(a) - ms(b) || (a.id < b.id ? -1 : 1);
const f = (n, d = 2) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });

const [wallets, assets, txs, rates] = await Promise.all([getAll('wallets?select=*'), getAll('assets?select=*'), getAll('transactions?select=*'), getAll('currency_rates?select=*')]);
console.log(`wallets=${wallets.length} assets=${assets.length} transactions=${txs.length}`);
const wById = new Map(wallets.map((w) => [w.id, w]));
const aById = new Map(assets.map((a) => [a.id, a]));
const rate = (c) => (c === 'IRT' ? 1 : Number(rates.find((r) => r.currency === c)?.toman_per_unit) || 0);

// ── Integrity checks across all rows ─────────────────────────
const issues = [];
const add = (kind, t, msg) => issues.push({ kind, date: t.date_string, type: t.type, note: String(t.note ?? '').slice(0, 28), msg, id: t.id.slice(0, 8) });
for (const t of txs) {
  if (t.source_wallet_id && !(Number(t.source_amount) > 0)) add('WALLET_AMOUNT_EMPTY', t, `source wallet "${wById.get(t.source_wallet_id)?.name ?? '?'}" but source_amount=${t.source_amount}`);
  if (t.target_wallet_id && !(Number(t.target_amount) > 0)) add('WALLET_AMOUNT_EMPTY', t, `target wallet "${wById.get(t.target_wallet_id)?.name ?? '?'}" but target_amount=${t.target_amount}`);
  for (const id of [t.source_wallet_id, t.target_wallet_id]) if (id && !wById.has(id)) add('WALLET_MISSING', t, `wallet ${id.slice(0, 8)} not found`);
  for (const id of [t.source_asset_id, t.target_asset_id, t.asset_id]) if (id && !aById.has(id)) add('ASSET_MISSING', t, `asset ${id.slice(0, 8)} not found`);
  if (t.source_wallet_id && t.source_wallet_id === t.target_wallet_id) add('SAME_WALLET', t, 'source = target wallet');
  // BUY / SELL: wallet side must match asset value (qty × price ÷ wallet rate).
  if ((t.type === 'BUY' || t.type === 'SELL') && Number(t.price_toman) > 0) {
    const wid = t.type === 'BUY' ? t.source_wallet_id : t.target_wallet_id;
    const wamt = Number(t.type === 'BUY' ? t.source_amount : t.target_amount);
    const qty = Number(t.amount ?? (t.type === 'BUY' ? t.target_amount : t.source_amount));
    const w = wById.get(wid);
    if (w && wamt > 0 && qty > 0) {
      const wr = w.currency === 'IRT' ? 1 : w.currency === 'USD' && Number(t.usd_rate) > 0 ? Number(t.usd_rate) : rate(w.currency);
      if (wr > 0) { const expect = (qty * Number(t.price_toman)) / wr; const diff = Math.abs(wamt - expect) / expect; if (diff > 0.02) add('VALUE_MISMATCH', t, `${w.name}: wallet=${f(wamt)} ${w.currency}, qty×price=${f(expect)} (${(diff * 100).toFixed(1)}% off)`); }
    }
  }
}
// Duplicates: same day, type, both endpoints and amounts.
const dupKey = (t) => [t.date_string, t.type, t.source_wallet_id, t.target_wallet_id, t.source_asset_id, t.target_asset_id, t.source_person_id, t.target_person_id, t.source_amount, t.target_amount, t.amount].join('|');
const groups = new Map(); for (const t of txs) { const k = dupKey(t); groups.set(k, [...(groups.get(k) ?? []), t]); }
for (const g of groups.values()) if (g.length > 1) add('POSSIBLE_DUPLICATE', g[0], `${g.length} identical rows: ${g.map((t) => t.id.slice(0, 8)).join(', ')}`);

// ── Wallets ──────────────────────────────────────────────────
const wrows = [];
for (const w of wallets) {
  const rows = txs.filter((t) => t.source_wallet_id === w.id || t.target_wallet_id === w.id).sort(byDate);
  let bal = Number(w.initial_balance) || 0, minBal = bal, minDate = '', negDays = 0;
  for (const t of rows) {
    if (t.target_wallet_id === w.id) bal += Number(t.target_amount) || 0;
    if (t.source_wallet_id === w.id) bal -= Number(t.source_amount) || 0;
    if (bal < -1e-6) negDays++;
    if (bal < minBal) { minBal = bal; minDate = t.date_string; }
  }
  wrows.push({ wallet: w.name, cur: w.currency, archived: !!w.archived_at, rows: rows.length, initial: f(w.initial_balance), balance: f(bal), lowest: f(minBal), lowestOn: minDate, negativeRows: negDays });
}
console.log('\n=== WALLETS (balance = app formula; "lowest" = lowest running balance in date order)');
console.table(wrows);

// ── Assets: old replay (clamp) vs fixed replay (short) ───────
const arows = [];
for (const a of assets) {
  const id = a.id;
  const acq = (t) => ((t.type === 'BUY' || t.type === 'INCOME') && (t.asset_id === id || t.target_asset_id === id)) || (t.type === 'TRANSFER' && t.target_asset_id === id);
  const dis = (t) => ((t.type === 'SELL' || t.type === 'EXPENSE') && (t.asset_id === id || t.source_asset_id === id)) || (t.type === 'TRANSFER' && t.source_asset_id === id);
  const poly = (t) => (acq(t) ? (t.target_asset_id === id ? t.target_amount : null) : t.source_asset_id === id ? t.source_amount : null);
  const qty = (t) => { const q = Number(t.amount ?? poly(t)); return q > 0 && Number(t.price_toman) > 0 ? q : 0; };
  const rows = txs.filter((t) => acq(t) || dis(t)).sort(byDate);
  let oldQ = 0, newQ = 0, short = 0, oversells = 0, skipped = 0, mismatch = 0;
  for (const t of rows) {
    const q = qty(t); const p = poly(t);
    if (!q) { skipped++; continue; }
    if (t.amount != null && p != null && Math.abs(Number(t.amount) - Number(p)) > 1e-9) mismatch++;
    if (acq(t)) { oldQ += q; const c = Math.min(q, short); short -= c; newQ += q - c; }
    else { if (q > oldQ + 1e-9) oversells++; oldQ = Math.max(0, oldQ - q); const d = Math.min(q, newQ); newQ -= d; short += q - d; }
  }
  const touching = txs.filter((t) => t.asset_id === id || t.source_asset_id === id || t.target_asset_id === id).length;
  arows.push({ asset: a.name, unit: a.unit, rows: rows.length, ignored: touching - rows.length, skipped, mismatch, oversells, oldShown: f(oldQ, 6), fixed: f(newQ, 6), stillShort: f(short, 6), changed: Math.abs(oldQ - newQ) > 1e-6 ? 'YES' : '' });
}
console.log('\n=== ASSETS (oldShown = before fix, fixed = after fix)');
console.table(arows);

console.log(`\n=== DATA ISSUES (${issues.length})`);
const kinds = [...new Set(issues.map((i) => i.kind))];
for (const k of kinds) { const l = issues.filter((i) => i.kind === k); console.log(`\n-- ${k} (${l.length})`); console.table(l.slice(0, 40).map(({ kind, ...r }) => r)); }
