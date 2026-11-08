'use client';

import { useRouter } from 'next/navigation';
import { ActionSheet } from '@/design-system';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpLeft, Coins, Landmark, RefreshCw } from '@/design-system/icons';

/** Long-press menu of the "+" button. Every transaction type is one tap. */
export function QuickAddActions({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const go = (type: string) => router.push(`/transactions/new?type=${type}`);
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      layout="grid"
      title="ثبت سریع"
      actions={[
        { key: 'EXPENSE', label: 'هزینه', icon: <ArrowUpLeft />, onSelect: () => go('EXPENSE') },
        { key: 'INCOME', label: 'درآمد', icon: <ArrowDownLeft />, onSelect: () => go('INCOME') },
        { key: 'TRANSFER', label: 'انتقال', icon: <ArrowLeftRight />, onSelect: () => go('TRANSFER') },
        { key: 'BUY', label: 'خرید دارایی', icon: <Coins />, onSelect: () => go('BUY') },
        { key: 'SELL', label: 'فروش دارایی', icon: <Landmark />, onSelect: () => go('SELL') },
        { key: 'CONVERT', label: 'تبدیل', icon: <RefreshCw />, onSelect: () => go('CONVERT') },
      ]}
    />
  );
}
