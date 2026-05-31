import { PriceSourceSettingsView } from '@/features/prices/components/PriceSourceSettingsView';
import { Modal } from '@/features/shell/components/Modal';

export default function ManagePriceSourcesModal() {
  return (
    <Modal>
      <PriceSourceSettingsView />
    </Modal>
  );
}
