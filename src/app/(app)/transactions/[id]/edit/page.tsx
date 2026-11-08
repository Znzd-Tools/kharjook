import { AddTransactionScreen } from '@/features/transactions/v2/AddTransactionScreen';

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AddTransactionScreen transactionId={id} />;
}
