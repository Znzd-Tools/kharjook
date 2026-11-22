import { describe, expect, it } from 'vitest';
import { applyReduction, moveBetweenPlaces, placeTolerance, placementOf, reconcileOver } from './placement';

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

  it('float noise below the shown unit is not unplaced (USDT, 2 decimals)', () => {
    const tol = placeTolerance(2);
    expect(placementOf(623.38, [{ place_id: 'ex', quantity: 623.3799999999999 }], tol)).toMatchObject({ unplaced: 0, over: 0 });
    expect(placementOf(623.382025, [{ place_id: 'ex', quantity: 623.38 }], tol)).toMatchObject({ unplaced: 0, over: 0 });
    expect(placementOf(623.39, [{ place_id: 'ex', quantity: 623.38 }], tol).unplaced).toBeCloseTo(0.01);
  });
  it('one place: a sell updates it automatically', () => {
    const r = reconcileOver(placementOf(800, [{ place_id: 'ex', quantity: 1100 }]));
    expect(r.kind === 'auto' && Object.fromEntries(r.next)).toEqual({ ex: 800 });
  });
  it('everything sold: all places go to zero without asking', () => {
    const r = reconcileOver(placementOf(0, [{ place_id: 'ex', quantity: 5 }, { place_id: 'tw', quantity: 3 }]));
    expect(r.kind === 'auto' && Object.fromEntries(r.next)).toEqual({ ex: 0, tw: 0 });
  });
  it('several places: ask; the split must match and sums exactly to the holding', () => {
    const p = placementOf(277.962025, [{ place_id: 'ex', quantity: 300 }, { place_id: 'tw', quantity: 100 }], placeTolerance(2));
    expect(reconcileOver(p).kind).toBe('ask');
    expect(applyReduction(p, new Map([['ex', 100]]), placeTolerance(2))).toHaveProperty('error');
    const r = applyReduction(p, new Map([['ex', 22.04], ['tw', 100]]), placeTolerance(2));
    expect('next' in r).toBe(true);
    if ('next' in r) {
      expect(r.next.get('tw')).toBe(0);
      expect(r.next.get('ex')).toBeCloseTo(277.962025, 9);
    }
  });
  it('cannot take more from a place than it has', () => {
    const p = placementOf(50, [{ place_id: 'ex', quantity: 30 }, { place_id: 'tw', quantity: 30 }]);
    expect(applyReduction(p, new Map([['ex', 5]]), 1e-9)).toHaveProperty('error');
    expect(applyReduction(p, new Map([['tw', 40]]), 1e-9)).toHaveProperty('error');
  });
});
