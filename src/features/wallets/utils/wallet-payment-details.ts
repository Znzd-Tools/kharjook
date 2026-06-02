import type { Wallet } from '@/shared/types/domain';

export interface WalletPaymentDetails {
  card_number: string | null;
  account_number: string | null;
  iban: string | null;
  account_owner_name: string | null;
}

export function walletPaymentDetailsFromWallet(wallet: Wallet): WalletPaymentDetails {
  return {
    card_number: wallet.card_number ?? null,
    account_number: wallet.account_number ?? null,
    iban: wallet.iban ?? null,
    account_owner_name: wallet.account_owner_name ?? null,
  };
}

export function walletHasPaymentDetails(wallet: Wallet): boolean {
  return Boolean(
    wallet.card_number ||
      wallet.account_number ||
      wallet.iban ||
      wallet.account_owner_name
  );
}

export function normalizeWalletPaymentDetails(input: {
  card_number: string;
  account_number: string;
  iban: string;
  account_owner_name: string;
}): WalletPaymentDetails {
  const card = input.card_number.replace(/\D/g, '');
  const account = input.account_number.replace(/\D/g, '');
  let iban = input.iban.replace(/\s/g, '').toUpperCase();
  if (iban && !iban.startsWith('IR')) {
    iban = `IR${iban.replace(/^IR/i, '')}`;
  }
  const ownerName = input.account_owner_name.replace(/\s+/g, ' ').trim();

  return {
    card_number: card || null,
    account_number: account || null,
    iban: iban || null,
    account_owner_name: ownerName || null,
  };
}

export function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
}

export function formatIban(value: string): string {
  const raw = value.replace(/\s/g, '').toUpperCase();
  if (!raw) return '';
  const prefix = raw.startsWith('IR') ? 'IR' : '';
  const body = prefix ? raw.slice(2) : raw;
  const grouped = body.replace(/(.{4})/g, '$1 ').trim();
  return prefix ? `${prefix}${grouped ? ` ${grouped}` : ''}` : grouped;
}

export function paymentDetailsFormFromWallet(wallet: Wallet): {
  card_number: string;
  account_number: string;
  iban: string;
  account_owner_name: string;
} {
  return {
    card_number: wallet.card_number ? formatCardNumber(wallet.card_number) : '',
    account_number: wallet.account_number ?? '',
    iban: wallet.iban ? formatIban(wallet.iban) : '',
    account_owner_name: wallet.account_owner_name ?? '',
  };
}
