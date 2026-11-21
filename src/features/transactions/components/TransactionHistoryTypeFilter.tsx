'use client';

import type { TransactionType } from '@/shared/types/domain';
import { Chip, ChipGroup } from '@/design-system';

export type TxHistoryTypeFilter = TransactionType | 'ALL';

const ORDER: TransactionType[] = [
  'BUY',
  'SELL',
  'TRANSFER',
  'INCOME',
  'EXPENSE',
];

const LABELS: Record<TransactionType, string> = {
  BUY: 'خرید',
  SELL: 'فروش',
  TRANSFER: 'انتقال',
  INCOME: 'درآمد',
  EXPENSE: 'هزینه',
};

export function TransactionHistoryTypeFilter({
  value,
  onChange,
}: {
  value: TxHistoryTypeFilter;
  onChange: (next: TxHistoryTypeFilter) => void;
}) {
  return (
    <ChipGroup aria-label="نوع تراکنش" value={[value]} onValueChange={(v) => v[0] && onChange(v[0] as TxHistoryTypeFilter)}>
      <Chip value="ALL">همه</Chip>
      {ORDER.map((t) => (
        <Chip key={t} value={t}>
          {LABELS[t]}
        </Chip>
      ))}
    </ChipGroup>
  );
}
