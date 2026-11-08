'use client';

import { useFlag } from '@/shared/lib/flags/client';
import { AddTransactionView } from '@/features/transactions/components/AddTransactionView';
import type { AddTransactionViewProps } from '@/features/transactions/components/AddTransactionView';
import { AddTransactionV2 } from './AddTransactionV2';

/**
 * Picks the add/edit screen. v2 is the default; the v1 form stays for
 * multi-row entry ("چندتایی") and when the v2.addFlow flag is off.
 */
export function AddTransactionScreen(props: AddTransactionViewProps & { multi?: boolean; text?: string }) {
  const v2 = useFlag('v2.addFlow');
  const { multi, text, ...rest } = props;
  if (v2 && !multi) return <AddTransactionV2 {...rest} text={text} />;
  return <AddTransactionView {...rest} />;
}
