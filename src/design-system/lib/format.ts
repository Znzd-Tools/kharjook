import { toPersianDigits } from '@/shared/utils/format-display-number';

export type Currency = 'TOMAN' | 'USD';

export interface FormatMoneyOptions {
  currency?: Currency;
  /** Show `+` for positive values. Default: false. */
  signed?: boolean;
  /** Compact notation: ۱٫۲ میلیون / ۳۵۰ هزار. Default: false. */
  compact?: boolean;
  /** Override decimals. Default: 0 for TOMAN, 2 for USD. */
  fractionDigits?: number;
  /** Persian digits. Default: true. */
  persianDigits?: boolean;
}

const COMPACT_STEPS = [
  { value: 1e12, label: 'هزار میلیارد' },
  { value: 1e9, label: 'میلیارد' },
  { value: 1e6, label: 'میلیون' },
  { value: 1e3, label: 'هزار' },
] as const;

export interface FormattedMoney {
  /** Sign character: '−', '+' or ''. */
  sign: string;
  /** Number part, grouped, without sign. */
  number: string;
  /** Unit text, e.g. "تومان", "میلیون تومان" or "$". */
  unit: string;
  /** Unit goes before the number (USD). */
  unitFirst: boolean;
  /** Full string for aria-label and plain-text use. */
  text: string;
}

/** Split money into parts so components can style number and unit apart. */
export function formatMoney(value: number, options: FormatMoneyOptions = {}): FormattedMoney {
  const {
    currency = 'TOMAN',
    signed = false,
    compact = false,
    persianDigits = true,
  } = options;
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const digits = options.fractionDigits ?? (currency === 'USD' ? 2 : 0);

  let scaled = abs;
  let scaleLabel = '';
  if (compact) {
    const step = COMPACT_STEPS.find((s) => abs >= s.value);
    if (step) {
      scaled = abs / step.value;
      scaleLabel = step.label;
    }
  }

  const raw = scaled.toLocaleString('en-US', {
    minimumFractionDigits: compact && scaleLabel ? 0 : digits,
    maximumFractionDigits: compact && scaleLabel ? 1 : digits,
  });
  const number = persianDigits ? toPersianDigits(raw).replace(/\./g, '٫').replace(/,/g, '٬') : raw;

  const sign = safe < 0 ? '−' : signed && safe > 0 ? '+' : '';
  const unitFirst = currency === 'USD';
  const unit = currency === 'USD' ? (scaleLabel ? `${scaleLabel} دلار` : '$') : scaleLabel ? `${scaleLabel} تومان` : 'تومان';
  const useUnitFirst = unitFirst && !scaleLabel;
  const text = useUnitFirst ? `${sign}${unit}${number}` : `${sign}${number} ${unit}`;

  return { sign, number, unit, unitFirst: useUnitFirst, text };
}

/** Percent with Persian digits and sign. 0.1234 → "+۱۲٫۳٪" when ratio=true. */
export function formatPercent(
  value: number,
  { signed = true, fractionDigits = 1, ratio = false }: { signed?: boolean; fractionDigits?: number; ratio?: boolean } = {}
): string {
  const v = ratio ? value * 100 : value;
  const safe = Number.isFinite(v) ? v : 0;
  const raw = Math.abs(safe).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
  const sign = safe < 0 ? '−' : signed && safe > 0 ? '+' : '';
  return `${sign}${toPersianDigits(raw).replace(/\./g, '٫')}٪`;
}

export { toPersianDigits };
