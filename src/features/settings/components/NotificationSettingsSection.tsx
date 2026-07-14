'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CalendarClock,
  Mail,
  MessageCircle,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/shared/components/Toast';

type NotificationSettings = {
  enabled: boolean;
  price_alert_enabled: boolean;
  expense_alert_enabled: boolean;
  report_enabled: boolean;
  report_interval: 'daily' | 'weekly';
};

type ToggleKey = 'enabled' | 'price_alert_enabled' | 'expense_alert_enabled' | 'report_enabled';

type PatchKey = ToggleKey | 'report_interval';

const TOGGLE_META: Record<
  ToggleKey,
  {
    title: string;
    subtitle: string;
    activeLabel: string;
    inactiveLabel: string;
    icon: typeof Bell;
    accent: 'amber' | 'sky' | 'rose' | 'violet';
    description: string;
  }
> = {
  enabled: {
    title: 'یادآور بدهی',
    subtitle: 'فقط قسط‌های سررسید امروز',
    activeLabel: 'قسط‌های امروز — ۹:۰۰ صبح',
    inactiveLabel: 'غیرفعال',
    icon: CalendarClock,
    accent: 'amber',
    description:
      'هر روز ساعت ۹ صبح (وقت تهران)، اگر قسطی برای امروز شمسی داشته باشید، در تلگرام پیام می‌گیرید.',
  },
  price_alert_enabled: {
    title: 'هشدار تغییر قیمت',
    subtitle: 'پس از به‌روزرسانی قیمت‌ها در بات',
    activeLabel: 'فعال — هنگام رفرش قیمت',
    inactiveLabel: 'غیرفعال',
    icon: TrendingUp,
    accent: 'sky',
    description:
      'وقتی در بات تلگرام «به‌روزرسانی قیمت‌ها» را بزنید، در صورت تغییر معنادار، پیام دریافت می‌کنید.',
  },
  expense_alert_enabled: {
    title: 'هشدار ثبت هزینه',
    subtitle: 'بلافاصله پس از ثبت هزینه',
    activeLabel: 'فعال — هر هزینه جدید',
    inactiveLabel: 'غیرفعال',
    icon: Receipt,
    accent: 'rose',
    description:
      'با ثبت هر هزینه (در اپ یا بات)، مبلغ و جمع هزینه امروز در تلگرام ارسال می‌شود.',
  },
  report_enabled: {
    title: 'گزارش خودکار',
    subtitle: 'درآمد/هزینه و ارزش پرتفوی',
    activeLabel: 'فعال — ۹:۰۰ صبح',
    inactiveLabel: 'غیرفعال',
    icon: Mail,
    accent: 'violet',
    description:
      'هر روز ساعت ۹ صبح (وقت تهران) خلاصه درآمد/هزینه امروز و ارزش پرتفوی در تلگرام ارسال می‌شود.',
  },
};

const ACCENT_STYLES = {
  amber: {
    iconOn: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    badgeOn: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    toggleOn: 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15',
    switchOn: 'bg-amber-500',
    iconAccent: 'text-amber-400',
  },
  sky: {
    iconOn: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    badgeOn: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    toggleOn: 'bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/15',
    switchOn: 'bg-sky-500',
    iconAccent: 'text-sky-400',
  },
  rose: {
    iconOn: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    badgeOn: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    toggleOn: 'bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15',
    switchOn: 'bg-rose-500',
    iconAccent: 'text-rose-400',
  },
  violet: {
    iconOn: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
    badgeOn: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    toggleOn: 'bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15',
    switchOn: 'bg-violet-500',
    iconAccent: 'text-violet-400',
  },
} as const;

function SettingsToggle({
  settingKey,
  checked,
  disabled,
  onChange,
}: {
  settingKey: ToggleKey;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const meta = TOGGLE_META[settingKey];
  const styles = ACCENT_STYLES[meta.accent];
  const Icon = meta.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
              checked ? styles.iconOn : 'bg-white/5 border-white/10 text-slate-500'
            }`}
          >
            {checked ? <Icon size={20} /> : <BellOff size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-white">{meta.title}</h3>
            <p className="text-xs text-slate-400 mt-1">{meta.subtitle}</p>
          </div>
        </div>
        <span
          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
            checked ? styles.badgeOn : 'bg-white/5 border-white/10 text-slate-500'
          }`}
        >
          {checked ? 'فعال' : 'خاموش'}
        </span>
      </div>

      <div className="flex gap-3 rounded-2xl bg-[#0F1015] border border-white/5 p-4">
        <Icon size={18} className={`${styles.iconAccent} shrink-0 mt-0.5`} />
        <p className="text-xs text-slate-400 leading-relaxed">{meta.description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`w-full flex items-center justify-between gap-4 rounded-2xl border p-4 text-right transition-colors disabled:opacity-50 ${
          checked ? styles.toggleOn : 'bg-[#0F1015] border-white/5 hover:border-white/10'
        }`}
      >
        <div>
          <p className="text-sm font-medium text-white">یادآوری خودکار در تلگرام</p>
          <p className="text-xs text-slate-500 mt-1">
            {checked ? meta.activeLabel : meta.inactiveLabel}
          </p>
        </div>
        <div
          className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${
            checked ? styles.switchOn : 'bg-white/10'
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              checked ? 'right-1' : 'right-6'
            }`}
          />
        </div>
      </button>
    </div>
  );
}

export function NotificationSettingsSection() {
  const toast = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PatchKey | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications/settings');
      if (!res.ok) throw new Error('load failed');
      const json = (await res.json()) as { settings: NotificationSettings };
      setSettings(json.settings);
    } catch {
      toast.error('خطا در دریافت تنظیمات.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const patchSetting = async (key: PatchKey, value: boolean | NotificationSettings['report_interval']) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value } as NotificationSettings);
    setSavingKey(key);
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error('save failed');
      const json = (await res.json()) as { settings: NotificationSettings };
      setSettings(json.settings);
      if (key === 'report_interval') {
        toast.success(value === 'weekly' ? 'گزارش هفتگی فعال شد.' : 'گزارش روزانه فعال شد.');
      } else {
        toast.success(value ? `${TOGGLE_META[key as ToggleKey].title} فعال شد.` : `${TOGGLE_META[key as ToggleKey].title} خاموش شد.`);
      }
    } catch {
      toast.error('خطا در ذخیره.');
      setSettings(previous);
      void loadSettings();
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading || !settings) {
    return (
      <section className="bg-[#1A1B26] border border-white/5 rounded-3xl p-5">
        <p className="text-sm text-slate-500 animate-pulse">در حال بارگذاری...</p>
      </section>
    );
  }

  const toggleKeys: ToggleKey[] = [
    'enabled',
    'price_alert_enabled',
    'expense_alert_enabled',
    'report_enabled',
  ];

  return (
    <section className="overflow-hidden bg-[#1A1B26] border border-white/5 rounded-3xl">
      <div className="bg-linear-to-l from-purple-500/15 via-violet-500/5 to-transparent px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center border bg-purple-500/15 border-purple-500/30 text-purple-300">
            <Bell size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">اعلان‌های تلگرام</h3>
            <p className="text-xs text-slate-400 mt-1">هر گزینه مستقل از بقیه قابل تنظیم است</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-8">
        {toggleKeys.map((key) => (
          <div key={key} className="space-y-3">
            <SettingsToggle
              settingKey={key}
              checked={settings[key]}
              disabled={savingKey !== null}
              onChange={(next) => void patchSetting(key, next)}
            />
            {key === 'report_enabled' && settings.report_enabled ? (
              <div className="rounded-2xl bg-[#0F1015] border border-white/5 p-4 space-y-2">
                <p className="text-xs text-slate-400">بازه ارسال گزارش</p>
                <div className="flex gap-2">
                  {(['daily', 'weekly'] as const).map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      disabled={savingKey !== null}
                      onClick={() => void patchSetting('report_interval', interval)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                        settings.report_interval === interval
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {interval === 'daily' ? 'روزانه' : 'هفتگی'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}

        <div className="rounded-2xl bg-[#0F1015] border border-white/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MessageCircle size={14} className="text-sky-400" />
            <span>منوی بات: ثبت سریع، گزارش‌ها، قیمت‌ها، تنظیمات</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            اقساط معوق، موجودی کیف‌ها، ثبت درآمد/هزینه — از دکمه‌های بات در دسترس است.
          </p>
        </div>
      </div>
    </section>
  );
}
