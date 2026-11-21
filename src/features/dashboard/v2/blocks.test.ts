import { describe, expect, it } from 'vitest';
import { BLOCKS, DEFAULT_LAYOUT, moveBlock, normalizeLayout } from './blocks';

describe('dashboard layout', () => {
  it('fills defaults and drops unknown keys', () => {
    const l = normalizeLayout({ order: ['pnl', 'nope', 'hero'], hidden: ['movers', 'x'] });
    // The user's own order of the blocks they had is kept.
    expect(l.order.filter((k) => k === 'pnl' || k === 'hero')).toEqual(['pnl', 'hero']);
    expect(l.order).toHaveLength(BLOCKS.length);
    expect(l.hidden).toEqual(['movers']);
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
  });
  it('puts a block that a stored layout does not know right after its default neighbour', () => {
    const stored = BLOCKS.map((b) => b.key).filter((k) => k !== 'places');
    const l = normalizeLayout({ order: [...stored].reverse(), hidden: [] });
    expect(l.order[l.order.indexOf('attention') + 1]).toBe('places');
  });
  it('moves a block up and down within bounds', () => {
    expect(moveBlock(DEFAULT_LAYOUT, 'attention', -1).order.slice(0, 2)).toEqual(['attention', 'hero']);
    expect(moveBlock(DEFAULT_LAYOUT, 'hero', -1)).toBe(DEFAULT_LAYOUT);
  });
});
