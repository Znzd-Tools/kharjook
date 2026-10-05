import type { Asset } from '@/shared/types/domain';

const DEFAULT_ASSET_DECIMALS = 4;
const MIN_ASSET_DECIMALS = 0;
const MAX_ASSET_DECIMALS = 12;

export function normalizeAssetDecimals(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ASSET_DECIMALS;
  const int = Math.trunc(n);
  return Math.max(MIN_ASSET_DECIMALS, Math.min(MAX_ASSET_DECIMALS, int));
}

export function assetDecimals(asset: Pick<Asset, 'decimal_places'> | null | undefined): number {
  return normalizeAssetDecimals(asset?.decimal_places);
}

export function formatAssetAmount(value: unknown, decimals: number): string {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe)) return '0';
  const places = normalizeAssetDecimals(decimals);
  // Truncate (never show more than is held), but on the DECIMAL string, not
  // with `Math.trunc(x * 10^n)`: binary floats break that — 0.29 * 100 is
  // 28.999… (shows 0.28), and a replay like 5 − 4.9 = 0.0999…96 showed 0.
  // `toFixed` with guard digits first rounds away that float noise.
  const guardDigits = Math.min(places + 6, 15);
  const [intPartRaw, fracPartRaw = ''] = Math.abs(safe).toFixed(guardDigits).split('.');
  const fracPart = fracPartRaw.slice(0, places).replace(/0+$/, '');
  const isZero = /^0*$/.test(intPartRaw) && fracPart === '';
  const sign = safe < 0 && !isZero ? '-' : '';
  const intPart = Number(intPartRaw).toLocaleString('en-US');
  return fracPart ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`;
}
