import { describe, expect, it } from 'vitest';
import type { Goal } from '@/shared/types/domain';
import { validateGoalSet } from './goal-validation';

const g = (p: Partial<Goal>): Goal => ({ id: Math.random().toString(), user_id: 'u', scope: 'asset', asset_id: null, category_id: null, target_kind: 'allocation_percent', target_quantity: null, target_percent: null, ...p });
const assets = [{ id: 'gold', category_id: 'metal' }, { id: 'coin', category_id: 'metal' }, { id: 'usd', category_id: 'fx' }];
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
});
