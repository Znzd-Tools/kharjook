/**
 * Feature flags for the UX v2 rollout.
 *
 * The v2 rollout is finished: every flag is on and the Settings switch
 * (آزمایشی) is removed. An old cookie from that switch is ignored, so no
 * one can be stuck on an old screen. Kept as code so a future rollout can
 * reuse it.
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
const ROLLOUT_DONE = true;

export function defaultFlags(): FlagState {
  return Object.fromEntries(Object.entries(FLAGS).map(([k, v]) => [k, v.default])) as FlagState;
}

/** Parse the cookie value. Unknown keys are ignored; bad JSON = defaults. */
export function parseFlags(raw: string | undefined | null): FlagState {
  const out = defaultFlags();
  // Rollout done: ignore saved overrides (see the note at the top).
  if (!raw || ROLLOUT_DONE) return out;
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
