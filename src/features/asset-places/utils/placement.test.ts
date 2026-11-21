import { describe, expect, it } from 'vitest';
import { moveBetweenPlaces, placementOf } from './placement';

describe('asset places', () => {
  it('2000 USDT in the exchange, then a buy of 200: 200 is unplaced', () => {
    const p = placementOf(2200, [{ place_id: 'ex', quantity: 2000 }]);
    expect(p).toMatchObject({ placed: 2000, unplaced: 200, over: 0 });
  });
  it('after a sell, places can hold more than you have: shown as over', () => {
    expect(placementOf(1500, [{ place_id: 'ex', quantity: 2000 }])).toMatchObject({ unplaced: 0, over: 500 });
  });
  it('move from unplaced into a place, and between places', () => {
    const cur = new Map([['ex', 2000]]);
    const r1 = moveBetweenPlaces(cur, 200, null, 'tw', 200);
    expect('next' in r1 && Object.fromEntries(r1.next)).toEqual({ ex: 2000, tw: 200 });
    const r2 = moveBetweenPlaces(cur, 0, 'ex', 'tw', 500);
    expect('next' in r2 && Object.fromEntries(r2.next)).toEqual({ ex: 1500, tw: 500 });
  });
  it('cannot move more than the source has', () => {
    expect(moveBetweenPlaces(new Map([['ex', 10]]), 0, 'ex', 'tw', 11)).toHaveProperty('error');
  });
});
