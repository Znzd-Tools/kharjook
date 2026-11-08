/**
 * A filled form from a URL (bank SMS inbox, later other sources).
 * Pure; the add screen applies it once. Nothing is saved without a tap.
 */
import type { TransactionType, Wallet } from '@/shared/types/domain';
import type { FormState } from './transaction-form-types';

type Kind = 'wallet' | 'asset' | 'person';

export interface EntryDraft {
  type: TransactionType;
  /** "wallet:<id>" etc. */
  src?: string;
  dst?: string;
  /** Toman amount of the side named by `side`. */
  amt?: string;
  side?: 'src' | 'dst';
  date?: string;
  note?: string;
  /** Open the person picker on this side. */
  person?: 'source' | 'target';
  sms?: string;
  pair?: string;
}

const ref = (v?: string): { kind: Kind; id: string } | null => {
  const m = v?.match(/^(wallet|asset|person):(.+)$/);
  return m ? { kind: m[1] as Kind, id: m[2]! } : null;
};

export function draftFromParams(p: Record<string, string | undefined>): EntryDraft | null {
  const types: TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER', 'BUY', 'SELL'];
  if (!p.sms && !p.amt) return null;
  const type = types.includes(p.type as TransactionType) ? (p.type as TransactionType) : 'EXPENSE';
  return {
    type,
    src: p.src,
    dst: p.dst,
    amt: p.amt && /^\d+(\.\d+)?$/.test(p.amt) ? p.amt : undefined,
    side: p.side === 'src' || p.side === 'dst' ? p.side : undefined,
    date: p.date && /^\d{4}\/\d{2}\/\d{2}$/.test(p.date) ? p.date : undefined,
    note: p.note?.slice(0, 200),
    person: p.to === 'person' ? 'target' : p.from === 'person' ? 'source' : undefined,
    sms: p.sms,
    pair: p.pair,
  };
}

/** The side the SMS amount belongs to. */
export function draftSide(d: EntryDraft): 'src' | 'dst' {
  if (d.side) return d.side;
  if (d.type === 'EXPENSE' || d.type === 'BUY') return 'src';
  if (d.type === 'INCOME' || d.type === 'SELL') return 'dst';
  return d.src && !d.dst ? 'src' : d.dst && !d.src ? 'dst' : 'src';
}

export function applyDraft(base: FormState, d: EntryDraft, wallets: Pick<Wallet, 'id' | 'currency'>[]): FormState {
  const f: FormState = { ...base, type: d.type };
  if (d.date) f.date = d.date;
  if (d.note) f.note = d.note;
  const s = ref(d.src);
  const t = ref(d.dst);
  if (s) {
    f.sourceKind = s.kind;
    f.sourceId = s.id;
  }
  if (t) {
    f.targetKind = t.kind;
    f.targetId = t.id;
  }
  if (!d.amt) return f;
  const side = draftSide(d);
  if (side === 'src') f.sourceAmount = d.amt;
  else f.targetAmount = d.amt;
  if (d.type === 'TRANSFER') {
    // Same money on both sides when both wallets are Toman (or the other side is not chosen yet).
    const cur = (r: typeof s) => (r?.kind === 'wallet' ? wallets.find((w) => w.id === r.id)?.currency : null);
    const mine = side === 'src' ? s : t;
    const other = side === 'src' ? t : s;
    const sameCurrency = !other || (other.kind === 'wallet' && cur(other) === cur(mine)) || other.kind === 'person';
    if (sameCurrency && d.side !== 'dst') {
      f.sourceAmount = d.amt;
      f.targetAmount = d.amt;
    }
  }
  return f;
}
