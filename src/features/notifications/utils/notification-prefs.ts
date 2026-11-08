/**
 * Notification center: which notification goes to which channel.
 * Stored in notification_settings.channels (jsonb). Missing keys use the
 * defaults below, so old rows and new users work without a migration of data.
 */
export type NotifChannel = 'telegram' | 'push';
export type NotifKey =
  | 'due_today.check'
  | 'due_today.subscription'
  | 'due_today.installment'
  | 'advance'
  | 'expense_reminder'
  | 'price_update';

export type NotifChannels = Partial<Record<NotifKey, Partial<Record<NotifChannel, boolean>>>>;

export const NOTIF_DEFAULTS: Record<NotifKey, Record<NotifChannel, boolean>> = {
  'due_today.check': { telegram: true, push: true },
  'due_today.subscription': { telegram: true, push: true },
  'due_today.installment': { telegram: true, push: true },
  advance: { telegram: true, push: true },
  expense_reminder: { telegram: false, push: false },
  price_update: { telegram: false, push: false },
};

export const NOTIF_KEYS = Object.keys(NOTIF_DEFAULTS) as NotifKey[];

export function isOn(channels: unknown, key: NotifKey, channel: NotifChannel): boolean {
  const c = (channels && typeof channels === 'object' ? channels : {}) as NotifChannels;
  const v = c[key]?.[channel];
  return typeof v === 'boolean' ? v : NOTIF_DEFAULTS[key][channel];
}

/** Clean user input: only known keys and booleans. */
export function sanitizeChannels(input: unknown): NotifChannels {
  const out: NotifChannels = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of NOTIF_KEYS) {
    const v = (input as Record<string, unknown>)[key];
    if (!v || typeof v !== 'object') continue;
    const entry: Partial<Record<NotifChannel, boolean>> = {};
    for (const ch of ['telegram', 'push'] as const) {
      const b = (v as Record<string, unknown>)[ch];
      if (typeof b === 'boolean') entry[ch] = b;
    }
    if (Object.keys(entry).length) out[key] = entry;
  }
  return out;
}

export const DUE_TODAY_KEY = {
  check: 'due_today.check',
  subscription: 'due_today.subscription',
  installment: 'due_today.installment',
} as const satisfies Record<string, NotifKey>;
