import assert from 'node:assert/strict';
import {
  advanceDueDateString,
  computeSettlePayAmount,
} from '@/features/deadlines/services/settle-subscription';
import type { CurrencyRate } from '@/shared/types/domain';

const rates: CurrencyRate[] = [
  { id: '1', user_id: 'u', currency: 'USD', toman_per_unit: 60_000, updated_at: '' },
  { id: '2', user_id: 'u', currency: 'TRY', toman_per_unit: 2_000, updated_at: '' },
  { id: '3', user_id: 'u', currency: 'EUR', toman_per_unit: 70_000, updated_at: '' },
];

const payAmount = computeSettlePayAmount(10, 'USD', 'IRT', rates);
assert.ok(payAmount != null);
assert.equal(payAmount, 600_000);

const tryPay = computeSettlePayAmount(100, 'TRY', 'USD', rates);
assert.ok(tryPay != null);
assert.ok(Math.abs(tryPay - 200_000 / 60_000) < 1e-9);

const nextMonth = advanceDueDateString('1404/01/31', 1, 'month');
assert.equal(nextMonth, '1404/02/31');

const nextWeek = advanceDueDateString('1404/01/01', 2, 'week');
assert.equal(nextWeek, '1404/01/15');

console.log('settle-subscription self-check ok');
