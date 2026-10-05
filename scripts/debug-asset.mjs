// Read-only. Replays one asset's holdings row by row, like calculateAssetStats.
// Usage:  node --env-file=.env scripts/debug-asset.mjs USDT
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const name = process.argv[2] ?? 'USDT';
if (!URL_ || !KEY) throw new Error('Run with: node --env-file=.env scripts/debug-asset.mjs USDT');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function getAll(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

const fa = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const dnum = (s) => { const p = fa(s).split(/[-/_\s]/); return p.length >= 3 ? +(p[0] + p[1].padStart(2, '0') + p[2].padStart(2, '0')) : 0; };

const assets = await getAll(`assets?select=*&name=ilike.*${encodeURIComponent(name)}*`);
if (!assets.length) throw new Error(`No asset matches "${name}"`);
for (const asset of assets) {
  const id = asset.id;
  const txs = await getAll(`transactions?select=*&user_id=eq.${asset.user_id}&or=(asset_id.eq.${id},source_asset_id.eq.${id},target_asset_id.eq.${id})`);
  const isAcq = (t) => ((t.type === 'BUY' || t.type === 'INCOME') && (t.asset_id === id || t.target_asset_id === id)) || (t.type === 'TRANSFER' && t.target_asset_id === id);
  const isDis = (t) => ((t.type === 'SELL' || t.type === 'EXPENSE') && (t.asset_id === id || t.source_asset_id === id)) || (t.type === 'TRANSFER' && t.source_asset_id === id);
  const poly = (t) => (isAcq(t) ? (t.target_asset_id === id ? t.target_amount : null) : (t.source_asset_id === id ? t.source_amount : null));
  const qty = (t) => { const a = Number(t.amount ?? poly(t)); const p = Number(t.price_toman); return a > 0 && p > 0 ? a : 0; };

  const counted = txs.filter((t) => isAcq(t) || isDis(t));
  const ignored = txs.filter((t) => !isAcq(t) && !isDis(t));
  const ms = (t) => new Date(t.created_at).getTime() || 0;
  const sorted = [...counted].sort((a, b) => dnum(a.date_string) - dnum(b.date_string) || ms(a) - ms(b) || (a.id < b.id ? -1 : 1));
  // Same-day fallback: acquisitions first only when created order would oversell.
  const order = []; let held = 0;
  for (let i = 0; i < sorted.length;) {
    let j = i; while (j < sorted.length && dnum(sorted[j].date_string) === dnum(sorted[i].date_string)) j++;
    const g = sorted.slice(i, j); let sim = held, ok = true;
    for (const t of g) { const q = qty(t); if (!q) continue; if (isAcq(t)) sim += q; else { if (q > sim * (1 + 1e-9) + 1e-15) { ok = false; break; } sim -= q; } }
    const og = ok ? g : [...g.filter(isAcq), ...g.filter((t) => !isAcq(t))];
    for (const t of og) { const q = qty(t); if (q) held = isAcq(t) ? held + q : Math.max(0, held - q); }
    order.push(...og); i = j;
  }

  console.log(`\n=== ${asset.name} (${id}) price_toman=${asset.price_toman} decimals=${asset.decimal_places}`);
  console.log(`rows touching asset: ${txs.length}, counted: ${counted.length}, NOT counted: ${ignored.length}\n`);
  let total = 0;
  const rows = [];
  for (const t of order) {
    const q = qty(t); const flags = [];
    const p = poly(t);
    if (!q) flags.push(`SKIPPED(price=${t.price_toman}, amount=${t.amount ?? p})`);
    if (t.amount != null && p != null && Math.abs(Number(t.amount) - Number(p)) > 1e-9) flags.push(`MISMATCH amount=${t.amount} vs ${isAcq(t) ? 'target' : 'source'}_amount=${p}`);
    if (t.asset_id && t.asset_id !== id && (t.source_asset_id === id || t.target_asset_id === id)) flags.push(`asset_id points to OTHER asset ${t.asset_id}`);
    let delta = 0;
    if (q) {
      if (isAcq(t)) delta = q;
      else { delta = -Math.min(q, total); if (q > total + 1e-9) flags.push(`OVERSELL held=${total} (lost ${q - total})`); }
    }
    total += delta;
    rows.push({ date: t.date_string, created: String(t.created_at).slice(0, 19), type: t.type, delta: +delta.toFixed(8), running: +total.toFixed(8), op: t.operation_id ? String(t.operation_id).slice(0, 8) : '', note: String(t.note ?? '').slice(0, 30), flags: flags.join(' | '), id: t.id });
  }
  console.table(rows);
  if (ignored.length) {
    console.log('\nRows that touch this asset but the replay IGNORES:');
    console.table(ignored.map((t) => ({ date: t.date_string, type: t.type, asset_id: t.asset_id, src_asset: t.source_asset_id, tgt_asset: t.target_asset_id, amount: t.amount, src_amt: t.source_amount, tgt_amt: t.target_amount, note: String(t.note ?? '').slice(0, 30), id: t.id })));
  }
  // Possible duplicates: same date, type and amount.
  const key = (t) => `${t.date_string}|${t.type}|${t.amount ?? poly(t)}`;
  const dup = Object.entries(Object.groupBy(counted, key)).filter(([, v]) => v.length > 1);
  if (dup.length) { console.log('\nPossible duplicate rows (same date + type + amount):'); for (const [k, v] of dup) console.log(' ', k, v.map((t) => t.id).join(', ')); }
  console.log(`\nFINAL holdings = ${total}`);
}
