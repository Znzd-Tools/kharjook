import { RedirectToPrices } from '@/features/prices/components/RedirectToPrices';
import { Modal } from '@/features/shell/components/Modal';

export default function ManageRatesModal() {
  return (
    <Modal>
      <RedirectToPrices />
    </Modal>
  );
}
