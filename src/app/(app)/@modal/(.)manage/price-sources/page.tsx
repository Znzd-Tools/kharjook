import { RedirectToPrices } from '@/features/prices/components/RedirectToPrices';
import { Modal } from '@/features/shell/components/Modal';

export default function ManagePriceSourcesModal() {
  return (
    <Modal>
      <RedirectToPrices advanced />
    </Modal>
  );
}
