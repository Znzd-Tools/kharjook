/**
 * Detailed bank SMS reader for the SMS inbox (pure; runs on server and
 * client). The amount rules come from the Telegram parser (tested); this
 * adds direction, balance, account/card, date, kind and OTP filtering.
 *
 * Bank formats differ. Send real samples (with numbers masked) to add a
 * test in parse-sms.test.ts before changing a rule.
 */
import { looksLikeBankSms, parseBankSms } from '@/features/notifications/telegram/utils/parse-bank-sms';

export type SmsDirection = 'in' | 'out';
export type SmsKind =
  | 'purchase'
  | 'transfer'
  | 'cash'
  | 'fee'
  | 'loan'
  | 'check'
  | 'salary'
  | 'profit'
  | 'deposit'
  | 'withdraw';

export interface ParsedSms {
  direction: SmsDirection;
  kind: SmsKind;
  amountToman: number;
  balanceToman: number | null;
  /** Digits of the account/card in the SMS (masked parts removed), last 4+ digits. */
  accountDigits: string | null;
  bank: string | null;
  /** Jalaali "1405/08/17" when the SMS has a date; else null. */
  dateString: string | null;
  time: string | null;
  /** Short readable text for the note (merchant, counterparty). */
  note: string;
}

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';
export function normalizeSms(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/‌/g, ' ')
    .replace(/\r/g, '');
}

const BANKS: [RegExp, string][] = [
  [/ملت|mellat/i, 'ملت'],
  [/ملی|melli|bmi/i, 'ملی'],
  [/صادرات|saderat|bsi/i, 'صادرات'],
  [/تجارت|tejarat/i, 'تجارت'],
  [/سپه|sepah/i, 'سپه'],
  [/پاسارگاد|pasargad|bpi/i, 'پاسارگاد'],
  [/سامان|saman/i, 'سامان'],
  [/رسالت|resalat/i, 'رسالت'],
  [/مسکن|maskan/i, 'مسکن'],
  [/کشاورزی|keshavarzi|agri/i, 'کشاورزی'],
  [/رفاه|refah/i, 'رفاه'],
  [/پارسیان|parsian/i, 'پارسیان'],
  [/اقتصاد\s*نوین|eghtesad|en ?bank/i, 'اقتصاد نوین'],
  [/آینده|ayandeh/i, 'آینده'],
  [/بانک\s*شهر|city ?bank|shahr/i, 'شهر'],
  [/بانک\s*دی|\bdey\b/i, 'دی'],
  [/سینا|sina/i, 'سینا'],
  [/بلو|blu/i, 'بلو'],
  [/توسعه\s*تعاون|tosee/i, 'توسعه تعاون'],
  [/کارآفرین|karafarin/i, 'کارآفرین'],
  [/سرمایه|sarmayeh/i, 'سرمایه'],
  [/خاورمیانه|middle ?east/i, 'خاورمیانه'],
  [/گردشگری|tourism/i, 'گردشگری'],
  [/ایران\s*زمین|iran ?zamin/i, 'ایران زمین'],
  [/پست\s*بانک|post ?bank/i, 'پست بانک'],
];

/** OTP / password / login messages: never stored. */
const OTP_RE = /رمز|کد\s*(?:تای?ید|تأیید|فعال|ورود|امنیتی)|یکبار\s*مصرف|پویا|otp|password|verification|login|ورود به/i;

const OUT_RE = /برداشت|خرید|پرداخت|کسر|انتقال\s*(?:از|وجه)|کارت\s*به\s*کارت\s*از|withdraw|purchase|debit|\bpos\b|پایا\s*به|ساتنا\s*به/i;
const IN_RE = /واریز|دریافت|سود|حقوق|انتقال\s*به\s*(?:حساب|کارت)\s*شما|deposit|credit|بستانکار/i;

export function isOtpSms(text: string): boolean {
  return OTP_RE.test(normalizeSms(text));
}

function detectDirection(t: string): SmsDirection | null {
  // An explicit sign next to a money number wins ("500,000-", "+2,000,000").
  for (const line of t.split('\n')) {
    if (/مانده|موجودی|balance/i.test(line)) continue;
    if (/(?:\d{1,3}(?:,\d{3})+|\d{4,})\s*-(?!\d)|(?<![\d/])-\s*(?:\d{1,3}(?:,\d{3})+|\d{4,})(?![\d/])/.test(line)) return 'out';
    if (/(?:\d{1,3}(?:,\d{3})+|\d{4,})\s*\+|\+\s*(?:\d{1,3}(?:,\d{3})+|\d{4,})/.test(line)) return 'in';
  }
  const out = OUT_RE.test(t);
  const inn = IN_RE.test(t);
  if (inn && !out) return 'in';
  if (out && !inn) return 'out';
  if (out && inn) {
    // "واریز ... برداشت" both present: the first keyword wins.
    const o = t.search(OUT_RE);
    const i = t.search(IN_RE);
    return i < o ? 'in' : 'out';
  }
  return null;
}

function detectKind(t: string, dir: SmsDirection): SmsKind {
  if (/کارمزد|fee/i.test(t) && !/خرید|انتقال|واریز/.test(t)) return 'fee';
  if (/قسط|وام|تسهیلات/i.test(t)) return 'loan';
  if (/چک|cheque|check/i.test(t)) return 'check';
  if (/انتقال|کارت\s*به\s*کارت|پایا|ساتنا|شبا|حواله|transfer/i.test(t)) return 'transfer';
  if (dir === 'out') {
    if (/خودپرداز|atm|نقدی/i.test(t)) return 'cash';
    if (/خرید|pos|پذیرنده|فروشگاه|purchase|اینترنتی/i.test(t)) return 'purchase';
    return 'withdraw';
  }
  if (/حقوق|salary/i.test(t)) return 'salary';
  if (/سود|interest|profit/i.test(t)) return 'profit';
  return 'deposit';
}

function detectBalance(t: string, fullText: string): number | null {
  for (const line of t.split('\n')) {
    if (!/مانده|موجودی|balance/i.test(line)) continue;
    const m = line.match(/(\d{1,3}(?:,\d{3})+|\d+)/);
    if (!m) continue;
    const raw = Number(m[1]!.replace(/,/g, ''));
    if (!Number.isFinite(raw)) continue;
    const toman = /تومان/.test(line) || (/تومان/.test(fullText) && !/ریال/.test(fullText)) ? raw : raw / 10;
    return Math.round(toman);
  }
  return null;
}

function detectAccount(t: string): string | null {
  for (const line of t.split('\n')) {
    if (/مانده|موجودی|balance|مبلغ/i.test(line)) continue;
    // 6037...1234, 1234*5678, 0101234567001, ح 123.456.789, کارت 1234
    const m = line.match(/(?:حساب|ح\b|ح\.|کارت|card|acc|از|به|شماره)?[\s.:]*((?:\d[\d.*\-x×]{2,}\d)|\*\d{4})/i);
    if (!m) continue;
    if (/\d{1,4}\/\d{1,2}\/\d{1,2}|\d{1,2}:\d{2}/.test(m[1]!)) continue;
    const digits = m[1]!.replace(/[^\d*x×.]/gi, '');
    const tail = digits.split(/[*x×.]+/).filter(Boolean).pop() ?? '';
    // A money number has thousands commas, which we skipped by the mask above.
    if (tail.length >= 4 && !/,/.test(m[0])) return tail.slice(-6);
  }
  return null;
}

function detectDate(t: string, today: { jy: number }): { date: string | null; time: string | null } {
  const time = t.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  const timeStr = time ? `${time[1]!.padStart(2, '0')}:${time[2]}` : null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const full = t.match(/(?<!\d)(\d{4}|\d{2})\/(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (full) {
    let y = Number(full[1]);
    if (y < 100) y += 1400 - (y > 50 ? 100 : 0);
    const m = Number(full[2]);
    const d = Number(full[3]);
    if (y > 1300 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { date: `${y}/${pad(m)}/${pad(d)}`, time: timeStr };
  }
  // Mellat style: "0805-14:23" (month day - time)
  const md = t.match(/(?<!\d)(\d{2})(\d{2})[-_ ]\s*\d{1,2}:\d{2}/);
  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { date: `${today.jy}/${pad(m)}/${pad(d)}`, time: timeStr };
  }
  return { date: null, time: timeStr };
}

function detectNote(t: string, bank: string | null): string {
  const lines = t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const useful = lines.filter((line) => {
    if (bank && line.includes(bank) && line.length < 20) return false;
    if (/^(بانک|bank)\b/i.test(line)) return false;
    if (/مانده|موجودی|balance/i.test(line)) return false;
    if (/^[\d\s,*.\-+:/_]+$/.test(line)) return false;
    if (/^(مبلغ|حساب|کارت|از|به|ح)[\s.:]*[\d*.,\-+]+(\s*(ریال|تومان))?$/.test(line)) return false;
    if (/^(برداشت|واریز|خرید|انتقال)[\s:]*[\d,+-]*\s*(ریال|تومان)?$/.test(line)) return false;
    return line.length >= 3;
  });
  return useful.slice(0, 2).join(' · ').slice(0, 80);
}

export function parseSms(
  rawText: string,
  opts: { sender?: string | null; today?: { jy: number } } = {}
): ParsedSms | null {
  const text = normalizeSms(rawText).trim();
  if (!text || isOtpSms(text)) return null;
  if (!looksLikeBankSms(text)) return null;
  const base = parseBankSms(text);
  if (!base) return null;

  const direction = detectDirection(text) ?? (base.txType === 'INCOME' ? 'in' : 'out');
  const senderAndText = `${opts.sender ?? ''}\n${text}`;
  const bank = BANKS.find(([re]) => re.test(senderAndText))?.[1] ?? null;
  const { date, time } = detectDate(text, opts.today ?? { jy: 1405 });
  const kind = detectKind(text, direction);
  const kindNote: Record<SmsKind, string> = {
    purchase: 'خرید', transfer: 'انتقال', cash: 'برداشت نقدی', fee: 'کارمزد', loan: 'قسط', check: 'چک',
    salary: 'حقوق', profit: 'سود', deposit: 'واریز', withdraw: 'برداشت',
  };
  return {
    direction,
    kind,
    amountToman: base.amountToman,
    balanceToman: detectBalance(text, text),
    accountDigits: detectAccount(text),
    bank,
    dateString: date,
    time,
    note: detectNote(text, bank) || [kindNote[kind], bank].filter(Boolean).join(' '),
  };
}
