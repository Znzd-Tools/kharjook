import { Suspense } from 'react';
import { TransactionsTab } from '@/features/transactions/components/TransactionsTab';

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsTab />
    </Suspense>
  );
}
