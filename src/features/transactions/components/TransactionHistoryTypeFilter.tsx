'use client';

import type { TransactionType } from '@/shared/types/domain';
import { FilterChip } from '@/shared/components/FilterChip';

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
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="نوع تراکنش">
      <FilterChip
        active={value === 'ALL'}
        onClick={() => onChange('ALL')}
        role="tab"
        aria-selected={value === 'ALL'}
      >
        همه
      </FilterChip>
      {ORDER.map((t) => (
        <FilterChip
          key={t}
          active={value === t}
          onClick={() => onChange(t)}
          role="tab"
          aria-selected={value === t}
        >
          {LABELS[t]}
        </FilterChip>
      ))}
    </div>
  );
}
