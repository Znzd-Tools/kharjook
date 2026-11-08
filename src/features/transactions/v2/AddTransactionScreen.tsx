'use client';

import { AddTransactionV2, type AddTransactionV2Props } from './AddTransactionV2';

/** The add / edit transaction screen (one form; «ثبت و بعدی» for many in a row). */
export function AddTransactionScreen(props: AddTransactionV2Props) {
  return <AddTransactionV2 {...props} />;
}
