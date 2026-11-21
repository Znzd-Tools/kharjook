import { Suspense } from 'react';
import { CheckFormView } from '@/features/deadlines/components/CheckFormView';

export default async function EditCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CheckFormView checkId={id} />
    </Suspense>
  );
}
