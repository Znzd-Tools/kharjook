'use client';

import { supabase } from '@/shared/lib/supabase/client';

export const SMS_CHANGED = 'kj:sms-changed';
const notify = () => typeof window !== 'undefined' && window.dispatchEvent(new Event(SMS_CHANGED));

/** Mark an SMS as recorded and remember its wallet (learning for next time). */
export async function markSmsDone(smsId: string, transactionId: string | null, walletId: string | null) {
  const res = await supabase
    .from('sms_inbox')
    .update({ status: 'done', transaction_id: transactionId, ...(walletId ? { wallet_id: walletId } : {}) })
    .eq('id', smsId);
  notify();
  return !res.error;
}

export async function setSmsStatus(smsId: string, status: 'new' | 'ignored') {
  const res = await supabase.from('sms_inbox').update({ status }).eq('id', smsId);
  notify();
  return !res.error;
}
