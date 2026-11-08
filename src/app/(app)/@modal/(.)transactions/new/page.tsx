import { AddTransactionScreen } from '@/features/transactions/v2/AddTransactionScreen';
import { Modal } from '@/features/shell/components/Modal';
import {
  CONVERT_UI_MODE,
  type UiTransactionMode,
} from '@/features/transactions/utils/convert-transaction';
import type { TransactionType } from '@/shared/types/domain';
import { draftFromParams } from '@/features/transactions/utils/entry-draft';

const VALID_TYPES: ReadonlySet<TransactionType> = new Set([
  'BUY',
  'SELL',
  'TRANSFER',
  'INCOME',
  'EXPENSE',
]);

export default async function NewTransactionModal({
  searchParams,
}: {
  searchParams: Promise<{
    assetId?: string;
    walletId?: string;
    targetAssetId?: string;
    sourceAmount?: string;
    targetAmount?: string;
    personId?: string;
    personSide?: string;
    amount?: string;
    type?: string;
    multi?: string;
    text?: string;
    title?: string;
    src?: string;
    dst?: string;
    amt?: string;
    side?: string;
    date?: string;
    note?: string;
    sms?: string;
    pair?: string;
    to?: string;
    from?: string;
  }>;
}) {
  const {
    assetId,
    walletId,
    targetAssetId,
    sourceAmount,
    targetAmount,
    personId,
    personSide,
    amount,
    type,
    multi,
    text,
    title,
  } = await searchParams;
  const draft = draftFromParams(await searchParams);

  let defaultUiMode: UiTransactionMode | undefined;
  let defaultType: TransactionType | undefined;

  if (type === CONVERT_UI_MODE) {
    defaultUiMode = CONVERT_UI_MODE;
  } else if (type && VALID_TYPES.has(type as TransactionType)) {
    defaultType = type as TransactionType;
  }

  return (
    <Modal>
      <AddTransactionScreen
        assetId={assetId}
        walletId={walletId}
        targetAssetId={targetAssetId}
        sourceAmount={sourceAmount}
        targetAmount={targetAmount}
        personId={personId}
        personSide={personSide === 'source' || personSide === 'target' ? personSide : undefined}
        settleAmount={amount}
        defaultType={defaultType}
        defaultUiMode={defaultUiMode}
      multi={multi === '1'}
      text={[title, text].filter(Boolean).join(' ') || undefined}
        draft={draft ?? undefined}
      />
    </Modal>
  );
}
