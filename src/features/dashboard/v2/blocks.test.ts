import { describe, expect, it } from 'vitest';
import { BLOCKS, DEFAULT_LAYOUT, moveBlock, normalizeLayout } from './blocks';

describe('dashboard layout', () => {
  it('fills defaults and drops unknown keys', () => {
    const l = normalizeLayout({ order: ['pnl', 'nope', 'hero'], hidden: ['movers', 'x'] });
    expect(l.order.slice(0, 2)).toEqual(['pnl', 'hero']);
    expect(l.order).toHaveLength(BLOCKS.length);
    expect(l.hidden).toEqual(['movers']);
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
  });
  it('moves a block up and down within bounds', () => {
    expect(moveBlock(DEFAULT_LAYOUT, 'attention', -1).order.slice(0, 2)).toEqual(['attention', 'hero']);
    expect(moveBlock(DEFAULT_LAYOUT, 'hero', -1)).toBe(DEFAULT_LAYOUT);
  });
});
