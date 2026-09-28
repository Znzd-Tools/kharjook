import { describe, expect, it } from 'vitest';
import { parseBankSms } from '@/features/notifications/telegram/utils/parse-bank-sms';

describe('parseBankSms', () => {
  it('reads an explicit Toman amount as Toman', () => {
    const r = parseBankSms('بانک ملت\nبرداشت 250,000 تومان\nمانده 3,000,000');
    expect(r?.amountToman).toBe(250_000);
    expect(r?.txType).toBe('EXPENSE');
  });

  it('converts an explicit Rial amount to Toman', () => {
    const r = parseBankSms('بانک ملی\nبرداشت 850,000 ریال\nمانده 9,000,000 ریال');
    expect(r?.amountToman).toBe(85_000);
  });

  it('treats small amounts without a unit as Rial (bank standard)', () => {
    const r = parseBankSms('بانک صادرات\nخرید\nمبلغ: 850,000\nمانده: 12,000,000');
    expect(r?.amountToman).toBe(85_000);
  });

  it('does not merge the amount with the next number', () => {
    const r = parseBankSms('بانک پاسارگاد\nمبلغ 250,000 1403/07/05 ریال\nمانده 1,000,000');
    expect(r?.amountToman).toBe(25_000);
  });

  it('skips account and balance lines when looking for the amount', () => {
    const r = parseBankSms('بانک ملی\nحساب 0113456789001\nبرداشت:1,500,000\nمانده:20,000,000');
    expect(r?.amountToman).toBe(150_000);
  });

  it('classifies an English "deposit" SMS as income', () => {
    const r = parseBankSms('Bank Melli\nDeposit amount: 1,000,000 rial\nbalance: 5,000,000');
    expect(r?.txType).toBe('INCOME');
    expect(r?.amountToman).toBe(100_000);
  });
});
