import { describe, expect, it } from 'vitest';
import type { Goal } from '@/shared/types/domain';
import { validateGoalSet } from './goal-validation';

const g = (p: Partial<Goal>): Goal => ({ id: Math.random().toString(), user_id: 'u', scope: 'asset', asset_id: null, category_id: null, target_kind: 'allocation_percent', target_quantity: null, target_percent: null, ...p });
const assets = [
  { id: 'gold', category_id: 'metal', name: 'طلا' },
  { id: 'coin', category_id: 'metal', name: 'سکه' },
  { id: 'usd', category_id: 'fx', name: 'دلار' },
  { id: 'btc', category_id: 'crypto', name: 'بیت‌کوین' },
  { id: 'usdt', category_id: 'crypto', name: 'تتر' },
];
const cats = [{ id: 'metal', name: 'فلزات' }, { id: 'fx', name: 'ارز' }];

describe('validateGoalSet', () => {
  it('accepts a valid set', () => {
    expect(validateGoalSet([g({ scope: 'asset_group', category_id: 'metal', target_percent: 50 }), g({ asset_id: 'gold', target_percent: 30 })], assets, cats)).toEqual([]);
  });
  it('groups or assets over 100%', () => {
    expect(validateGoalSet([g({ scope: 'asset_group', category_id: 'metal', target_percent: 70 }), g({ scope: 'asset_group', category_id: 'fx', target_percent: 40 })], assets, cats)[0]).toContain('گروه‌ها');
  });
  it('assets in a group above the group goal', () => {
    const r = validateGoalSet([g({ scope: 'asset_group', category_id: 'metal', target_percent: 40 }), g({ asset_id: 'gold', target_percent: 30 }), g({ asset_id: 'coin', target_percent: 20 })], assets, cats);
    expect(r[0]).toContain('فلزات');
  });
  it('duplicate goal', () => {
    expect(validateGoalSet([g({ asset_id: 'gold', target_percent: 10 }), g({ asset_id: 'gold', target_percent: 20 })], assets, cats)).toContain('برای یک مورد دو هدف از یک نوع ثبت شده است.');
  });

  const basket = (p: Partial<Goal>) => g({ scope: 'basket', name: 'ریسکی', asset_ids: ['btc', 'usd'], target_percent: 40, ...p });
  it('a set of assets (basket) with one goal is valid', () => {
    expect(validateGoalSet([basket({}), g({ scope: 'asset_group', category_id: 'metal', target_percent: 50 })], assets, cats)).toEqual([]);
  });
  it('groups + sets over 100%', () => {
    expect(validateGoalSet([basket({ target_percent: 60 }), g({ scope: 'asset_group', category_id: 'metal', target_percent: 50 })], assets, cats)[0]).toContain('مجموعه‌ها');
  });
  it('a set needs two assets', () => {
    expect(validateGoalSet([basket({ asset_ids: ['btc'] })], assets, cats)[0]).toContain('حداقل دو');
  });
  it('an asset in two sets', () => {
    const r = validateGoalSet([basket({}), basket({ name: 'دوم', asset_ids: ['btc', 'usdt'], target_percent: 10 })], assets, cats);
    expect(r.some((x) => x.includes('بیت‌کوین') && x.includes('دو مجموعه'))).toBe(true);
  });
  it('an asset in a set and in a group with a goal counts twice', () => {
    const r = validateGoalSet([basket({ asset_ids: ['gold', 'btc'] }), g({ scope: 'asset_group', category_id: 'metal', target_percent: 20 })], assets, cats);
    expect(r.some((x) => x.includes('طلا') && x.includes('فلزات'))).toBe(true);
  });
  it('asset goals inside a set above the set goal', () => {
    const r = validateGoalSet([basket({ target_percent: 20 }), g({ asset_id: 'btc', target_percent: 25 })], assets, cats);
    expect(r.some((x) => x.includes('ریسکی'))).toBe(true);
  });
});
