import { Suspense } from 'react';
import { LedgerV2 } from '@/features/transactions/v2/LedgerV2';

export default function TransactionsPage() {
  return (
    <Suspense>
      <LedgerV2 />
    </Suspense>
  );
}
