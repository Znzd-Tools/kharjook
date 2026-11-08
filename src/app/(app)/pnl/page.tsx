import { Suspense } from 'react';
import { PnlScreen } from '@/features/pnl/components/PnlScreen';

export default function PnlPage() {
  return (
    <Suspense>
      <PnlScreen />
    </Suspense>
  );
}
