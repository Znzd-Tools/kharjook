import type { ReactNode } from 'react';
import { Avatar, Text } from '@/design-system';
import { Wallet } from '@/design-system/icons';

/** Login / register frame: logo, title, one centered card. */
export function AuthShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-stretch justify-center bg-canvas sm:items-center sm:p-4">
      <div className="flex w-full flex-col justify-center gap-8 bg-canvas p-6 sm:max-w-md sm:rounded-sheet sm:bg-panel sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar size="xl" shape="rounded" tone="accent" fallback={<Wallet />} />
          <Text variant="headline" weight="bold">
            خرجوک
          </Text>
          {subtitle && (
            <Text variant="caption" tone="subtle">
              {subtitle}
            </Text>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
