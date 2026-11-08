import { AddTransactionScreen } from '@/features/transactions/v2/AddTransactionScreen';
import { Modal } from '@/features/shell/components/Modal';

export default async function EditTransactionModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Modal>
      <AddTransactionScreen transactionId={id} />
    </Modal>
  );
}
