import { AddTransactionView } from '@/features/transactions/components/AddTransactionView';
import {
  CONVERT_UI_MODE,
  type UiTransactionMode,
} from '@/features/transactions/utils/convert-transaction';
import type { TransactionType } from '@/shared/types/domain';

const VALID_TYPES: ReadonlySet<TransactionType> = new Set([
  'BUY',
  'SELL',
  'TRANSFER',
  'INCOME',
  'EXPENSE',
]);

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{
    assetId?: string;
    walletId?: string;
    targetAssetId?: string;
    sourceAmount?: string;
    targetAmount?: string;
    type?: string;
  }>;
}) {
  const { assetId, walletId, targetAssetId, sourceAmount, targetAmount, type } =
    await searchParams;

  let defaultUiMode: UiTransactionMode | undefined;
  let defaultType: TransactionType | undefined;

  if (type === CONVERT_UI_MODE) {
    defaultUiMode = CONVERT_UI_MODE;
  } else if (type && VALID_TYPES.has(type as TransactionType)) {
    defaultType = type as TransactionType;
  }

  return (
    <AddTransactionView
      assetId={assetId}
      walletId={walletId}
      targetAssetId={targetAssetId}
      sourceAmount={sourceAmount}
      targetAmount={targetAmount}
      defaultType={defaultType}
      defaultUiMode={defaultUiMode}
    />
  );
}
