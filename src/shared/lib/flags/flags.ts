/**
 * Feature flags for the UX v2 rollout.
 *
 * Every new screen ships behind one flag. If something is wrong, turn the
 * flag off in Settings → آزمایشی and the old screen comes back. Flags are
 * stored in a cookie so server components can read them too.
 */
export const FLAGS = {
  'v2.shell': { label: 'ناوبری جدید (۴ تب)', default: true },
  'v2.addFlow': { label: 'ثبت تراکنش جدید', default: true },
  'v2.ledger': { label: 'لیست تراکنش‌های جدید', default: true },
  'v2.plan': { label: 'تب برنامه (سررسیدها)', default: true },
  'v2.pnl': { label: 'سود و زیان جدید', default: true },
  'v2.dashboard': { label: 'داشبورد جدید', default: true },
} as const;

export type FlagName = keyof typeof FLAGS;
export type FlagState = Record<FlagName, boolean>;

export const FLAG_COOKIE = 'kj_flags';

export function defaultFlags(): FlagState {
  return Object.fromEntries(Object.entries(FLAGS).map(([k, v]) => [k, v.default])) as FlagState;
}

/** Parse the cookie value. Unknown keys are ignored; bad JSON = defaults. */
export function parseFlags(raw: string | undefined | null): FlagState {
  const out = defaultFlags();
  if (!raw) return out;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    for (const key of Object.keys(FLAGS) as FlagName[]) {
      if (typeof parsed[key] === 'boolean') out[key] = parsed[key] as boolean;
    }
  } catch {
    // keep defaults
  }
  return out;
}

export function serializeFlags(state: Partial<FlagState>): string {
  return encodeURIComponent(JSON.stringify(state));
}
