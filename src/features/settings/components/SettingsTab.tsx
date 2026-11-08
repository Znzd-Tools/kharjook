'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, Button, List, ListRow, Section, SegmentedControl, TopBar, useConfirm } from '@/design-system';
import { Download, LayoutGrid, Percent, Repeat, Target, TrendingUp } from '@/design-system/icons';
import { useAuth, useUI } from '@/features/portfolio/PortfolioProvider';
import { latinizeDigits } from '@/shared/utils/latinize-digits';
import { TelegramConnectionSection } from '@/features/settings/components/TelegramConnectionSection';
import { NotificationSettingsSection } from '@/features/settings/components/NotificationSettingsSection';
import { PasskeySettingsSection } from '@/features/settings/components/PasskeySettingsSection';
import { LabsSettingsSection } from '@/features/settings/components/LabsSettingsSection';
import { PushSettingsSection } from '@/features/settings/components/PushSettingsSection';

const LINKS = [
  { href: '/manage/categories', title: 'دسته‌بندی‌ها و سقف هزینه', icon: <LayoutGrid />, tone: 'peach' as const },
  { href: '/manage/recurring', title: 'تراکنش‌های دوره‌ای', icon: <Repeat />, tone: 'mint' as const },
  { href: '/manage/goals', title: 'اهداف تخصیص', icon: <Target />, tone: 'lilac' as const },
  { href: '/manage/rates', title: 'نرخ ارزها', icon: <Percent />, tone: 'sky' as const },
  { href: '/manage/price-sources', title: 'منابع قیمت', icon: <TrendingUp />, tone: 'lemon' as const },
  { href: '/manage/import', title: 'ورود تراکنش از CSV', icon: <Download />, tone: 'rose' as const },
];

export function SettingsTab() {
  const router = useRouter();
  const confirm = useConfirm();
  const { user, logout } = useAuth();
  const { currencyMode, setCurrencyMode } = useUI();

  if (!user) return null;

  const displayName = user.email ? user.email.split('@')[0] : user.phone ?? '';

  const handleLogout = async () => {
    const ok = await confirm({ title: 'از حساب خارج می‌شوی؟', confirmLabel: 'خروج', tone: 'danger' });
    if (!ok) return;
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-full bg-canvas pb-24">
      <TopBar onBack={() => router.back()} title="تنظیمات" />

      <div className="space-y-6 px-(--ds-gutter) pt-2">
        <div className="flex items-center gap-4 rounded-card bg-panel p-4">
          <Avatar size="lg" tone="lilac" name={displayName} />
          <div className="min-w-0">
            <p className="text-caption text-fg-subtle">حساب</p>
            <p className="truncate text-body font-semibold text-fg" dir="ltr">
              {latinizeDigits(displayName)}
            </p>
          </div>
        </div>

        <Section title="نمایش">
          <div className="flex items-center justify-between gap-4 rounded-card bg-panel p-4">
            <span className="text-callout font-medium text-fg">واحد نمایش مبالغ</span>
            <SegmentedControl
              aria-label="واحد نمایش مبالغ"
              size="sm"
              fullWidth={false}
              value={currencyMode}
              onValueChange={setCurrencyMode}
              options={[
                { value: 'TOMAN', label: 'تومان' },
                { value: 'USD', label: 'دلار' },
              ]}
            />
          </div>
        </Section>

        <Section title="مدیریت">
          <List>
            {LINKS.map((l) => (
              <ListRow
                key={l.href}
                render={<Link href={l.href} />}
                leading={<Avatar size="sm" tone={l.tone} fallback={l.icon} />}
                title={l.title}
                size="sm"
              />
            ))}
          </List>
        </Section>

        <TelegramConnectionSection />
        <PasskeySettingsSection />
        <NotificationSettingsSection />
        <PushSettingsSection />
        <LabsSettingsSection />

        <Button variant="danger" fullWidth size="lg" onClick={handleLogout}>
          خروج از حساب
        </Button>
      </div>
    </div>
  );
}
