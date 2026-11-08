'use client';

import { useFlag } from '@/shared/lib/flags/client';
import { AddTransactionView } from '@/features/transactions/components/AddTransactionView';
import type { AddTransactionViewProps } from '@/features/transactions/components/AddTransactionView';
import { AddTransactionV2 } from './AddTransactionV2';
import type { EntryDraft } from '@/features/transactions/utils/entry-draft';

/**
 * Picks the add/edit screen. v2 is the default; the v1 form stays for
 * multi-row entry ("چندتایی") and when the v2.addFlow flag is off.
 */
export function AddTransactionScreen(props: AddTransactionViewProps & { multi?: boolean; text?: string; draft?: EntryDraft }) {
  const v2 = useFlag('v2.addFlow');
  const { multi, text, draft, ...rest } = props;
  // A draft (bank SMS) always uses v2: only v2 knows how to fill and link it.
  if ((v2 || draft) && !multi) return <AddTransactionV2 {...rest} text={text} draft={draft} />;
  return <AddTransactionView {...rest} />;
}
