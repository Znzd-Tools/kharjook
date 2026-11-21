'use client';

import { useEffect, useState } from 'react';
import { Button, Field, Input, Sheet, toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import type { Wallet } from '@/shared/types/domain';
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import {
  formatCardNumber,
  formatIban,
  normalizeWalletPaymentDetails,
  paymentDetailsFormFromWallet,
} from '@/features/wallets/utils/wallet-payment-details';

export interface WalletPaymentDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  wallet: Wallet;
  onSaved: (wallet: Wallet) => void;
}

export function WalletPaymentDetailsSheet({
  open,
  onClose,
  wallet,
  onSaved,
}: WalletPaymentDetailsSheetProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [accountOwnerName, setAccountOwnerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const form = paymentDetailsFormFromWallet(wallet);
    setCardNumber(form.card_number);
    setAccountNumber(form.account_number);
    setIban(form.iban);
    setAccountOwnerName(form.account_owner_name);
  }, [open, wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeWalletPaymentDetails({
      card_number: cardNumber,
      account_number: accountNumber,
      iban,
      account_owner_name: accountOwnerName,
    });

    setIsSubmitting(true);
    try {
      await runOptimisticMutation({
        snapshot: wallet,
        applyOptimistic: () => {
          onSaved({ ...wallet, ...normalized });
        },
        rollback: (prev) => {
          onSaved(prev);
        },
        commit: async () => {
          const { data, error } = await supabase
            .from('wallets')
            .update(normalized)
            .eq('id', wallet.id)
            .select()
            .single();
          if (error) throw error;
          return data as Wallet;
        },
        onSuccess: (saved) => {
          onSaved(saved);
          toast.success('اطلاعات حساب ذخیره شد.');
          onClose();
        },
        onError: () => {
          toast.error('خطا در ذخیره.');
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="اطلاعات حساب"
      description="همه اختیاری‌اند. برای کارت و حساب فقط رقم وارد کن."
      footer={
        <Button type="submit" form="wallet-payment-details" size="lg" fullWidth loading={isSubmitting}>
          ذخیره
        </Button>
      }
    >
      <form id="wallet-payment-details" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Field label="نام صاحب حساب">
          <Input autoComplete="name" placeholder="مثلاً علی رضایی" value={accountOwnerName} onChange={(e) => setAccountOwnerName(e.target.value)} />
        </Field>
        <Field label="شماره کارت">
          <Input
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            placeholder="6037 9912 3456 7890"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            maxLength={19}
          />
        </Field>
        <Field label="شماره حساب">
          <Input
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            placeholder="۱۰ رقم یا بیشتر"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="شبا (IBAN)">
          <Input
            autoComplete="off"
            dir="ltr"
            placeholder="IR12 3456 7890 1234 5678 9012 34"
            value={iban}
            onChange={(e) => setIban(formatIban(e.target.value))}
            maxLength={32}
          />
        </Field>
      </form>
    </Sheet>
  );
}
