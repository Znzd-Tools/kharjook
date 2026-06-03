import { PersonDetailView } from '@/features/persons/components/PersonDetailView';

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonDetailView personId={id} />;
}
