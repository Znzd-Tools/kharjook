'use client';

import { SearchField } from '@/design-system';

export function TransactionHistorySearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <SearchField
      value={value}
      onValueChange={onChange}
      placeholder="جستجو در یادداشت، دسته، مبلغ..."
      aria-label="جستجو در تاریخچه تراکنش‌ها"
    />
  );
}
