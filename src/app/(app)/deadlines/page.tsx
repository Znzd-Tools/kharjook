import { Suspense } from 'react';
import { PlanTabV2 } from '@/features/deadlines/v2/PlanTabV2';

export default function DeadlinesPage() {
  return (
    <Suspense>
      <PlanTabV2 />
    </Suspense>
  );
}
