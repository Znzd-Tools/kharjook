/**
 * True when `remaining` units after a disposal are only float noise, so the
 * position is closed and its cost basis must reset to zero.
 *
 * The tolerance is RELATIVE to the units held before the disposal. A fixed
 * tolerance (the old `0.000001`) wiped real positions of assets with tiny
 * units (e.g. 0.0000008 BTC) and reset their cost basis by mistake.
 */
export function isClosedPosition(remaining: number, unitsBefore: number): boolean {
  return remaining <= Math.max(Math.abs(unitsBefore) * 1e-9, 1e-15);
}
