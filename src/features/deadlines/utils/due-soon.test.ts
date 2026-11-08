import { describe, expect, it } from 'vitest';
import { countDueSoon } from './due-soon';

describe('countDueSoon', () => {
  const today = { jy: 1405, jm: 8, jd: 17 };
  it('counts overdue and the next 7 days only', () => {
    const items = ['1405/08/01', '1405/08/17', '1405/08/24', '1405/08/25', '1405/09/10'].map((due) => ({ due }));
    expect(countDueSoon(items, today)).toBe(3);
  });
  it('crosses month ends', () => {
    expect(countDueSoon([{ due: '1405/09/02' }], { jy: 1405, jm: 8, jd: 28 })).toBe(1);
  });
});
