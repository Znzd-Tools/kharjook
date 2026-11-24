import { describe, expect, it } from 'vitest';
import { squarify } from './squarify';

describe('squarify', () => {
  it('areas are proportional and fill the box', () => {
    const r = squarify([{ key: 'a', value: 6 }, { key: 'b', value: 3 }, { key: 'c', value: 1 }], 100, 100);
    const area = Object.fromEntries(r.map((x) => [x.key, x.w * x.h]));
    expect(area.a).toBeCloseTo(6000, 6);
    expect(area.b).toBeCloseTo(3000, 6);
    expect(area.c).toBeCloseTo(1000, 6);
    for (const x of r) {
      expect(x.x).toBeGreaterThanOrEqual(-1e-9);
      expect(x.y).toBeGreaterThanOrEqual(-1e-9);
      expect(x.x + x.w).toBeLessThanOrEqual(100 + 1e-9);
      expect(x.y + x.h).toBeLessThanOrEqual(100 + 1e-9);
    }
  });
  it('drops zero and negative values; empty input', () => {
    expect(squarify([{ key: 'a', value: 0 }, { key: 'b', value: -1 }])).toEqual([]);
    expect(squarify([{ key: 'a', value: 5 }])).toEqual([{ key: 'a', x: 0, y: 0, w: 100, h: 100 }]);
  });
  it('cells are not thin slivers for similar values', () => {
    const r = squarify(Array.from({ length: 9 }, (_, i) => ({ key: String(i), value: 1 })), 100, 100);
    for (const x of r) expect(Math.max(x.w / x.h, x.h / x.w)).toBeLessThan(3);
  });
});
