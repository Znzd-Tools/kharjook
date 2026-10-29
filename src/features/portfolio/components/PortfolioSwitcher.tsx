'use client';

import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@/shared/components/ui';

/** Assets and wallets are two views of one portfolio tab. */
export function PortfolioSwitcher({ value }: { value: 'assets' | 'wallets' }) {
  const router = useRouter();
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => router.replace(next === 'assets' ? '/assets' : '/wallets')}
      options={[
        { value: 'assets', label: 'دارایی‌ها' },
        { value: 'wallets', label: 'کیف پول‌ها' },
      ]}
    />
  );
}
