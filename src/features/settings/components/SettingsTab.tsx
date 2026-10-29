'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/features/portfolio/PortfolioProvider';
import { latinizeDigits } from '@/shared/utils/latinize-digits';
import { TelegramConnectionSection } from '@/features/settings/components/TelegramConnectionSection';
import { NotificationSettingsSection } from '@/features/settings/components/NotificationSettingsSection';
import { PasskeySettingsSection } from '@/features/settings/components/PasskeySettingsSection';
import { IconBadge, ListGroup, ListRow, PageHeader, Section } from '@/shared/components/ui';

export function SettingsTab() {
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) return null;

  const displayName = user.email ? user.email.split('@')[0] : user.phone ?? '';

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title="تنظیمات" />

      <div className="px-4 pt-5 space-y-7">
        <ListGroup>
          <ListRow
            leading={
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white">
                <UserIcon size={22} strokeWidth={1.75} />
              </span>
            }
            title={<span dir="ltr">{latinizeDigits(displayName)}</span>}
            subtitle={user.email ?? undefined}
          />
        </ListGroup>

        <Section title="اتصال‌ها و امنیت">
          <div className="space-y-3">
            <TelegramConnectionSection />
            <PasskeySettingsSection />
          </div>
        </Section>

        <NotificationSettingsSection />

        <ListGroup>
          <ListRow
            onClick={() => void handleLogout()}
            leading={
              <IconBadge color="#fb7185">
                <LogOut size={18} strokeWidth={1.9} />
              </IconBadge>
            }
            title={<span className="text-rose-400">خروج از حساب</span>}
          />
        </ListGroup>
      </div>
    </div>
  );
}
