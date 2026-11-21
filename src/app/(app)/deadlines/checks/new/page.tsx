import { Suspense } from 'react';
import { CheckFormView } from '@/features/deadlines/components/CheckFormView';

export default function NewCheckPage() {
  return (
    <Suspense>
      <CheckFormView />
    </Suspense>
  );
}
