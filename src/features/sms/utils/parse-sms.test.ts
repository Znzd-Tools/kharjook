import { describe, expect, it } from 'vitest';
import { isOtpSms, parseSms } from './parse-sms';

const today = { jy: 1405 };

describe('parseSms — bank formats', () => {
  it('Mellat withdraw with MMDD-time', () => {
    const r = parseSms('بانک ملت\nبرداشت:1,500,000\nاز:123456789\nمانده:12,345,670\n0805-14:23', { today });
    expect(r).toMatchObject({ direction: 'out', amountToman: 150_000, balanceToman: 1_234_567, bank: 'ملت', dateString: '1405/08/05', time: '14:23', accountDigits: '456789' });
  });

  it('Melli transfer with trailing minus', () => {
    const r = parseSms('بانک ملی ایران\nانتقال:500,000-\nحساب:0101234567001\nمانده:3,000,000\n1405/08/05-12:30', { today });
    expect(r).toMatchObject({ direction: 'out', kind: 'transfer', amountToman: 50_000, dateString: '1405/08/05', time: '12:30' });
    expect(r?.accountDigits).toBe('567001');
  });

  it('Melli deposit with trailing plus', () => {
    const r = parseSms('بانک ملی ایران\nواریز:20,000,000+\nحساب:0101234567001\nمانده:23,000,000\n1405/08/06-09:10', { today });
    expect(r).toMatchObject({ direction: 'in', kind: 'deposit', amountToman: 2_000_000 });
  });

  it('Saderat purchase with masked card', () => {
    const r = parseSms('بانک صادرات\nخرید\nمبلغ: 850,000\nکارت:6037...1234\nمانده: 12,000,000\n1405/08/05 12:30\nفروشگاه کافه لمیز', { today });
    expect(r).toMatchObject({ direction: 'out', kind: 'purchase', amountToman: 85_000, accountDigits: '1234' });
    expect(r?.note).toContain('کافه لمیز');
  });

  it('Tejarat with 2-digit year', () => {
    const r = parseSms('تجارت\nحساب 123.456\nبرداشت 250,000\nمانده 1,000,000\n05/08/05_13:20', { today });
    expect(r).toMatchObject({ direction: 'out', amountToman: 25_000, bank: 'تجارت', dateString: '1405/08/05' });
  });

  it('Saman card to card in, Persian digits', () => {
    const r = parseSms('بانک سامان\nکارت به کارت\nبه کارت شما\nمبلغ ۲,۰۰۰,۰۰۰+\nمانده ۵,۰۰۰,۰۰۰', { today });
    expect(r).toMatchObject({ direction: 'in', kind: 'transfer', amountToman: 200_000 });
  });

  it('salary and profit are income kinds', () => {
    expect(parseSms('بانک پاسارگاد\nواریز حقوق\nمبلغ 450,000,000 ریال\nمانده 500,000,000', { today })).toMatchObject({ direction: 'in', kind: 'salary', amountToman: 45_000_000 });
    expect(parseSms('بانک ملت\nواریز سود\nمبلغ:1,200,000\nمانده:9,000,000', { today })).toMatchObject({ direction: 'in', kind: 'profit' });
  });

  it('Toman amount stays Toman (Blu)', () => {
    expect(parseSms('بلو\nخرید ۱۲۰,۰۰۰ تومان\nمانده ۳,۰۰۰,۰۰۰ تومان', { today })).toMatchObject({ amountToman: 120_000, balanceToman: 3_000_000, bank: 'بلو' });
  });

  it('bank from the sender name', () => {
    expect(parseSms('برداشت:1,000,000\nمانده:5,000,000', { sender: 'Mellat', today })?.bank).toBe('ملت');
  });
});

describe('parseSms — safety', () => {
  it('drops OTP / password messages', () => {
    expect(isOtpSms('رمز پویا: 123456\nمبلغ: 1,000,000\nبانک ملت')).toBe(true);
    expect(parseSms('رمز پویا: 123456\nمبلغ: 1,000,000\nبانک ملت')).toBeNull();
    expect(parseSms('کد تایید شما 4321 است')).toBeNull();
  });
  it('drops non-bank text', () => {
    expect(parseSms('سلام، فردا ساعت 10 جلسه داریم')).toBeNull();
  });
});
