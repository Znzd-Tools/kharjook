export type ParsedBankSms = {
  txType: 'INCOME' | 'EXPENSE';
  amountToman: number;
  bankHint: string | null;
  note: string;
  confidence: 'high' | 'medium' | 'low';
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

function parseNumberToken(raw: string): number | null {
  const normalized = normalizeDigits(raw).replace(/[,،٬_\s]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeForMatch(text: string): string {
  return normalizeDigits(text)
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INCOME_PATTERN =
  /واری[زز]|واري[زز]|دری[اا]فت|واریز به|سود(?:\s|$)|deposit|credit/i;
// `\bpos\b` — a bare `pos` also matched inside "deposit".
const EXPENSE_PATTERN =
  /برداشت|خری[دد]|خري[دد]|پرداخت|انتقال(?:\s+وجه|\s|$)|\bpos\b|خرید|purchase|withdraw/i;

const BANK_PATTERN =
  /بانک\s+[\u0600-\u06FFa-zA-Z]+|bank\s+[\w]+/i;

function detectTxType(text: string): 'INCOME' | 'EXPENSE' | null {
  const income = INCOME_PATTERN.test(text);
  const expense = EXPENSE_PATTERN.test(text);
  if (income && !expense) return 'INCOME';
  if (expense && !income) return 'EXPENSE';
  if (expense) return 'EXPENSE';
  if (income) return 'INCOME';
  return null;
}

function extractBankHint(text: string): string | null {
  const match = text.match(BANK_PATTERN);
  return match?.[0]?.trim() ?? null;
}

function extractNote(text: string, bankHint: string | null): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const skip = new Set(['بانک', 'کارت', 'مانده', 'موجودی', 'balance']);
  const useful = lines.filter((line) => {
    const lower = line.toLowerCase();
    if (bankHint && line.includes(bankHint)) return false;
    if (/^\*+\d+$/.test(line.replace(/\s/g, ''))) return false;
    if (/^[\d*]{4,}$/.test(line.replace(/\s/g, ''))) return false;
    if (skip.has(line)) return false;
    if (/^مبلغ/i.test(line)) return false;
    if (/^amount/i.test(line)) return false;
    if (/مانده|موجودی|balance/i.test(line)) return false;
    return line.length >= 3;
  });
  const note = useful.slice(0, 2).join(' · ').trim();
  return note.slice(0, 120);
}

/**
 * One money number: digits with optional thousands separators. No spaces or
 * dots inside, so "250,000 1403" is never merged into one number. The
 * look-arounds reject pieces of dates such as "1403/07/05" (lines with
 * times are skipped separately).
 */
const NUM = String.raw`(?<![\d/,،٬])(\d{1,3}(?:[,،٬]\d{3})+|\d+)(?![\d/:])`;
const RIAL_RE = /ریال|ريال|rial/i;
const TOMAN_RE = /تومان/i;
const AMOUNT_KEYWORD_RE = new RegExp(
  String.raw`(?:مبلغ|amount|برداشت|واری[زز]|واري[زز]|خری[دد]|خري[دد]|پرداخت|انتقال|دری[اا]فت)[\s:：\-]*` +
    NUM +
    String.raw`\s*(تومان|ریال|ريال|rial)?`,
  'i'
);
/** Lines that hold balances, accounts, cards, dates or times — never the amount. */
const NON_AMOUNT_LINE_RE =
  /مانده|موجودی|balance|حساب|کارت|card|شبا|\d{1,2}:\d{2}|\d{2,4}\/\d{1,2}\/\d{1,2}|\*/i;

/**
 * Iranian bank SMS report amounts in RIAL unless they say تومان.
 * An explicit unit next to the number wins; then a unit anywhere in the
 * text; with no unit at all we assume Rial (bank standard).
 */
function toToman(raw: number, unitNearNumber: string | undefined, fullText: string): number {
  if (unitNearNumber) return TOMAN_RE.test(unitNearNumber) ? raw : raw / 10;
  if (TOMAN_RE.test(fullText) && !RIAL_RE.test(fullText)) return raw;
  return raw / 10;
}

function extractAmountToman(rawText: string): number | null {
  // Keep line breaks: they separate amount lines from balance/date lines.
  const text = normalizeDigits(rawText).replace(/‌/g, ' ');

  // 1) A number directly followed by a unit.
  const withUnit = text.match(new RegExp(NUM + String.raw`\s*(تومان|ریال|ريال|rial)`, 'i'));
  if (withUnit) {
    const lineOfMatch = text
      .split(/\n/)
      .find((line) => line.includes(withUnit[0]));
    if (!lineOfMatch || !/مانده|موجودی|balance/i.test(lineOfMatch)) {
      const raw = parseNumberToken(withUnit[1] ?? '');
      if (raw) return toToman(raw, withUnit[2], text);
    }
  }

  // 2) A number right after an amount / transaction keyword.
  for (const line of text.split(/\n/)) {
    if (/مانده|موجودی|balance/i.test(line)) continue;
    const m = line.match(AMOUNT_KEYWORD_RE);
    if (!m) continue;
    const raw = parseNumberToken(m[1] ?? '');
    if (raw) return toToman(raw, m[2], text);
  }

  // 3) First plausible number on a line that is not a balance/account/date.
  for (const line of text.split(/\n/)) {
    if (NON_AMOUNT_LINE_RE.test(line)) continue;
    const m = line.match(new RegExp(NUM));
    if (!m) continue;
    const digits = (m[1] ?? '').replace(/[,،٬]/g, '');
    if (digits.length < 4) continue;
    const raw = parseNumberToken(m[1] ?? '');
    if (raw) return toToman(raw, undefined, text);
  }

  return null;
}

export function looksLikeBankSms(text: string): boolean {
  const normalized = normalizeForMatch(text);
  if (normalized.length < 20) return false;

  const signals = [
    /بانک/i,
    /کارت/i,
    /card/i,
    /ریال|ريال|rial/i,
    /تومان/i,
    /مبلغ/i,
    /amount/i,
    /حساب/i,
    /برداشت/,
    /واری[زز]|واري[زز]/,
    /خری[دد]|خري[دد]/,
    /پرداخت/,
    /انتقال/,
    /مانده/,
    /موجودی/,
    /balance/i,
  ];

  let hits = 0;
  for (const pattern of signals) {
    if (pattern.test(normalized)) hits += 1;
  }
  return hits >= 2;
}

export function parseBankSms(rawText: string): ParsedBankSms | null {
  const text = rawText.trim();
  if (!looksLikeBankSms(text)) return null;

  const normalized = normalizeForMatch(text);
  const amountToman = extractAmountToman(text);
  if (!amountToman || amountToman <= 0) return null;

  const txType = detectTxType(normalized) ?? 'EXPENSE';
  const bankHint = extractBankHint(normalized);
  const note = extractNote(text, bankHint) || bankHint || 'پیامک بانکی';

  let confidence: ParsedBankSms['confidence'] = 'low';
  if (detectTxType(normalized) && (bankHint || /مبلغ|amount|کارت|card/i.test(normalized))) {
    confidence = 'high';
  } else if (detectTxType(normalized) || bankHint) {
    confidence = 'medium';
  }

  return {
    txType,
    amountToman: Math.round(amountToman),
    bankHint,
    note,
    confidence,
  };
}
