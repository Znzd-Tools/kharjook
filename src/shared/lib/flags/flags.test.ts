import { describe, expect, it } from 'vitest';
import { defaultFlags, parseFlags, serializeFlags } from './flags';

describe('flags', () => {
  it('uses defaults for empty or broken cookies', () => {
    expect(parseFlags(undefined)).toEqual(defaultFlags());
    expect(parseFlags('%%%not-json')).toEqual(defaultFlags());
  });
  it('reads booleans and ignores unknown keys', () => {
    const raw = serializeFlags({ 'v2.shell': false, nope: true } as never);
    const f = parseFlags(raw);
    expect(f['v2.shell']).toBe(false);
    expect('nope' in f).toBe(false);
  });
});
