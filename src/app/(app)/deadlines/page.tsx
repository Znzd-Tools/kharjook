import { Suspense } from 'react';
import { DeadlinesTab } from '@/features/deadlines/components/DeadlinesTab';

export default function DeadlinesPage() {
  return (
    <Suspense>
      <DeadlinesTab />
    </Suspense>
  );
}
