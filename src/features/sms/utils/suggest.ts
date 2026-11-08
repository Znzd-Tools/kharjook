/**
 * What can this bank SMS be? Pure: the inbox shows the first choice as
 * the main button and the rest under "گزینه‌های دیگر".
 *
 * Money out: expense · transfer to my other account · buy an asset ·
 *            pay a person · pay a check / installment / subscription
 * Money in:  income · transfer from my other account · sell an asset ·
 *            currency convert (from a non-Toman wallet) · person paid me
 * Both:      "already recorded" when a matching transaction exists.
 *
 * Every choice opens the normal add form, filled, so nothing is saved
 * without the user's tap (except a deadline pay, which has undo).
 */
import type { Transaction, Wallet } from '@/shared/types/domain';
import type { TimelineItem } from '@/features/deadlines/utils/timeline';
import type { ParsedSms } from './parse-sms';

export interface SmsRow {
  id: string;
  sender: string | null;
  body: string;
  received_at: string;
  parsed: ParsedSms;
  status: 'new' | 'done' | 'ignored';
  wallet_id: string | null;
  transaction_id: string | null;
}

export type SmsChoice =
  | { key: string; label: string; type: 'form'; href: string }
  | { key: string; label: string; type: 'match'; transactionId: string }
  | { key: string; label: string; type: 'settle'; item: TimelineItem; walletId: string | null };

export interface SmsSuggestion {
  walletId: string | null;
  date: string;
  duplicate: Transaction | null;
  pair: SmsRow | null;
  choices: SmsChoice[];
}

const digitsOf = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** Which of my wallets is this SMS about? */
export function matchWallet(sms: SmsRow, wallets: Wallet[], history: SmsRow[]): string | null {
  const active = wallets.filter((w) => !w.archived_at);
  const acc = sms.parsed.accountDigits;
  if (acc && acc.length >= 4) {
    const tail = acc.slice(-4);
    const hit = active.filter((w) =>
      [w.card_number, w.account_number, w.iban].some((f) => digitsOf(f).length >= 4 && digitsOf(f).endsWith(tail))
    );
    if (hit.length === 1) return hit[0]!.id;
  }
  // Learned: the wallet chosen last time for the same sender + account.
  const learned = history.find(
    (h) => h.wallet_id && h.status === 'done' && h.sender === sms.sender && h.parsed.accountDigits === sms.parsed.accountDigits
  );
  if (learned && active.some((w) => w.id === learned.wallet_id)) return learned.wallet_id;
  const toman = active.filter((w) => w.currency === 'IRT');
  if (sms.parsed.bank) {
    const byName = toman.filter((w) => w.name.includes(sms.parsed.bank!));
    if (byName.length === 1) return byName[0]!.id;
  }
  return toman.length === 1 ? toman[0]!.id : null;
}

const dayNum = (date: string) => {
  const [y, m, d] = date.split('/').map(Number) as [number, number, number];
  // Close enough for "within N days" (months are 29–31 days).
  return y * 372 + (m - 1) * 31 + d;
};

export function buildSuggestion(
  sms: SmsRow,
  ctx: {
    wallets: Wallet[];
    transactions: Transaction[];
    inbox: SmsRow[];
    deadlines: TimelineItem[];
    receivedDate: (iso: string) => string;
  }
): SmsSuggestion {
  const p = sms.parsed;
  const out = p.direction === 'out';
  const walletId = sms.wallet_id ?? matchWallet(sms, ctx.wallets, ctx.inbox);
  const date = p.dateString ?? ctx.receivedDate(sms.received_at);
  const amount = p.amountToman;

  // Already recorded? Same wallet side, same Toman amount, ±1 day, not linked to another SMS.
  const linked = new Set(ctx.inbox.map((r) => r.transaction_id).filter(Boolean));
  const duplicate =
    ctx.transactions.find((t) => {
      if (linked.has(t.id)) return false;
      if (Math.abs(dayNum(t.date_string) - dayNum(date)) > 1) return false;
      const side = out ? t.source_wallet_id : t.target_wallet_id;
      if (walletId && side !== walletId) return false;
      if (!side) return false;
      const amt = Number(out ? t.source_amount : t.target_amount);
      const wallet = ctx.wallets.find((w) => w.id === side);
      return wallet?.currency === 'IRT' && Math.abs(amt - amount) < 1;
    }) ?? null;

  // The other half of a transfer between my own accounts.
  const received = new Date(sms.received_at).getTime();
  const pair =
    ctx.inbox.find((r) => {
      if (r.id === sms.id || r.status !== 'new') return false;
      if (r.parsed.direction === p.direction || r.parsed.amountToman !== amount) return false;
      if (Math.abs(new Date(r.received_at).getTime() - received) > 30 * 60_000) return false;
      const other = r.wallet_id ?? matchWallet(r, ctx.wallets, ctx.inbox);
      return !walletId || !other || other !== walletId;
    }) ?? null;
  const pairWallet = pair ? pair.wallet_id ?? matchWallet(pair, ctx.wallets, ctx.inbox) : null;

  const base = { amt: String(amount), date, note: p.note, sms: sms.id };
  const href = (q: Record<string, string | null | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...q })) if (v) s.set(k, v);
    return `/transactions/new?${s.toString()}`;
  };
  const w = walletId ? `wallet:${walletId}` : null;
  const name = (id: string | null) => ctx.wallets.find((x) => x.id === id)?.name ?? 'حساب دیگر';

  const choices: SmsChoice[] = [];
  if (duplicate) choices.push({ key: 'match', label: 'قبلاً ثبت شده؛ همین است', type: 'match', transactionId: duplicate.id });

  if (pair) {
    const [from, to] = out ? [walletId, pairWallet] : [pairWallet, walletId];
    choices.push({
      key: 'pair',
      label: `انتقال از «${name(from)}» به «${name(to)}»`,
      type: 'form',
      href: href({ type: 'TRANSFER', src: from ? `wallet:${from}` : null, dst: to ? `wallet:${to}` : null, pair: pair.id }),
    });
  }

  if (out) {
    const matches = ctx.deadlines.filter(
      (d) => d.currency === 'IRT' && !d.assetId && Math.abs(d.amount - amount) <= Math.max(1, amount * 0.01) && Math.abs(d.daysLeft) <= 10
    );
    for (const d of matches.slice(0, 2)) {
      const label = d.kind === 'check' ? 'پرداخت چک' : d.kind === 'installment' ? 'پرداخت قسط' : 'پرداخت اشتراک';
      choices.push({ key: `settle:${d.key}`, label: `${label} «${d.title}»`, type: 'settle', item: d, walletId: walletId ?? d.walletId });
    }
    const expense = { key: 'expense', label: 'هزینه', type: 'form' as const, href: href({ type: 'EXPENSE', src: w }) };
    const transfer = { key: 'transfer', label: 'انتقال به حساب دیگرم', type: 'form' as const, href: href({ type: 'TRANSFER', src: w }) };
    if (p.kind === 'transfer' && !pair) choices.push(transfer, expense);
    else choices.push(expense, ...(pair ? [] : [transfer]));
    choices.push(
      { key: 'buy', label: 'خرید دارایی (طلا، ارز، سهام…)', type: 'form', href: href({ type: 'BUY', src: w }) },
      { key: 'person', label: 'پرداخت یا قرض به شخص', type: 'form', href: href({ type: 'TRANSFER', src: w, to: 'person' }) }
    );
  } else {
    const income = { key: 'income', label: 'درآمد', type: 'form' as const, href: href({ type: 'INCOME', dst: w }) };
    const transfer = { key: 'transfer', label: 'انتقال از حساب دیگرم', type: 'form' as const, href: href({ type: 'TRANSFER', dst: w }) };
    const foreign = ctx.wallets.find((x) => !x.archived_at && x.currency !== 'IRT');
    if (p.kind === 'transfer' && !pair) choices.push(transfer, income);
    else choices.push(income, ...(pair ? [] : [transfer]));
    choices.push(
      { key: 'sell', label: 'فروش دارایی (طلا، ارز، سهام…)', type: 'form', href: href({ type: 'SELL', dst: w }) },
      {
        key: 'convert',
        label: 'تبدیل ارز به تومان',
        type: 'form',
        href: href({ type: 'TRANSFER', dst: w, src: foreign ? `wallet:${foreign.id}` : null, side: 'dst' }),
      },
      { key: 'person', label: 'دریافت از شخص (طلب یا قرض)', type: 'form', href: href({ type: 'TRANSFER', dst: w, from: 'person' }) }
    );
  }
  return { walletId, date, duplicate, pair, choices };
}
