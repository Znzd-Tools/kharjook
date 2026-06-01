import { Suspense } from 'react';
import { DailyPricesView } from '@/features/prices/components/DailyPricesView';

export default function PricesPage() {
  return (
    <Suspense fallback={null}>
      <DailyPricesView />
    </Suspense>
  );
}
