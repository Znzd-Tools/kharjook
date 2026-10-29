'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  CalendarClock,
  Mail,
  MessageCircle,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/shared/components/Toast';
import {
  Card,
  IconBadge,
  ListGroup,
  Section,
  SegmentedControl,
  SwitchVisual,
} from '@/shared/components/ui';

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

const ACCENT_COLOR: Record<(typeof TOGGLE_META)[ToggleKey]['accent'], string> = {
  amber: '#fbbf24',
  sky: '#38bdf8',
  rose: '#fb7185',
  violet: '#a78bfa',
};

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
  const Icon = meta.icon;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 px-4 py-4 text-right transition-colors hover:bg-surface-hover disabled:opacity-60"
    >
      <IconBadge color={checked ? ACCENT_COLOR[meta.accent] : undefined}>
        <Icon size={18} strokeWidth={1.9} />
      </IconBadge>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-100">{meta.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{meta.description}</span>
      </span>
      <span className="pt-1.5">
        <SwitchVisual checked={checked} />
      </span>
    </button>
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
      <Section title="اعلان‌های تلگرام">
        <Card>
          <p className="text-sm text-zinc-500 animate-pulse">در حال بارگذاری...</p>
        </Card>
      </Section>
    );
  }

  const toggleKeys: ToggleKey[] = [
    'enabled',
    'price_alert_enabled',
    'expense_alert_enabled',
    'report_enabled',
  ];

  return (
    <Section title="اعلان‌های تلگرام" description="هر گزینه مستقل از بقیه تنظیم می‌شود.">
      <ListGroup>
        {toggleKeys.map((key) => (
          <div key={key}>
            <SettingsToggle
              settingKey={key}
              checked={settings[key]}
              disabled={savingKey !== null}
              onChange={(next) => void patchSetting(key, next)}
            />
            {key === 'report_enabled' && settings.report_enabled ? (
              <div className="px-4 pb-4 pr-17">
                <SegmentedControl
                  size="sm"
                  value={settings.report_interval}
                  onChange={(interval) => {
                    if (savingKey === null) void patchSetting('report_interval', interval);
                  }}
                  options={[
                    { value: 'daily', label: 'روزانه' },
                    { value: 'weekly', label: 'هفتگی' },
                  ]}
                />
              </div>
            ) : null}
          </div>
        ))}
      </ListGroup>
      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-zinc-500">
        <MessageCircle size={14} className="mt-0.5 shrink-0" />
        منوی بات: ثبت سریع، گزارش‌ها، قیمت‌ها، اقساط معوق و موجودی کیف‌ها.
      </p>
    </Section>
  );
}
