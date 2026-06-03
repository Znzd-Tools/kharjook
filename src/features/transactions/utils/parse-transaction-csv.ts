import { latinizeDigits } from '@/shared/utils/latinize-digits';
import { parseJalaali } from '@/shared/utils/jalali';

export const TRANSACTION_CSV_TEMPLATE = `date,type,amount,wallet,category,note
1403/04/15,expense,500000,ملی,خوراک,ناهار
1403/04/16,income,10000000,ملی,حقوق,
`;

export const MAX_TRANSACTION_CSV_ROWS = 200;

export type ParsedCsvRow = {
  lineNumber: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  amountToman: number;
  walletName: string;
  categoryName: string;
  note: string;
};

export type CsvLineError = {
  lineNumber: number;
  message: string;
};

const HEADER_ALIASES: Record<string, 'date' | 'amountToman' | 'walletName' | 'categoryName' | 'note'> = {
  date: 'date',
  تاریخ: 'date',
  amount: 'amountToman',
  مبلغ: 'amountToman',
  wallet: 'walletName',
  کیف: 'walletName',
  'کیف پول': 'walletName',
  category: 'categoryName',
  دسته: 'categoryName',
  note: 'note',
  یادداشت: 'note',
  توضیح: 'note',
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function normalizeType(raw: string): 'INCOME' | 'EXPENSE' | null {
  const v = latinizeDigits(raw).trim().toLowerCase();
  if (['income', 'درآمد', 'inc'].includes(v)) return 'INCOME';
  if (['expense', 'هزینه', 'exp'].includes(v)) return 'EXPENSE';
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = latinizeDigits(raw).replace(/[,_\s]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function normalizeDate(raw: string): string | null {
  const s = latinizeDigits(raw).trim().replace(/-/g, '/');
  const parsed = parseJalaali(s);
  if (!parsed) return null;
  return `${parsed.jy}/${String(parsed.jm).padStart(2, '0')}/${String(parsed.jd).padStart(2, '0')}`;
}

function mapHeaderIndex(cells: string[]): Map<keyof ParsedCsvRow, number> | null {
  const lower = cells.map((c) => latinizeDigits(c).trim().toLowerCase());
  const hasKnown = lower.some((c) => c in HEADER_ALIASES || c === 'type' || c === 'نوع');
  if (!hasKnown) return null;

  const index = new Map<keyof ParsedCsvRow, number>();
  lower.forEach((cell, i) => {
    if (cell === 'type' || cell === 'نوع') {
      index.set('type', i);
      return;
    }
    const mapped = HEADER_ALIASES[cell];
    if (mapped === 'date') index.set('date', i);
    else if (mapped === 'amountToman') index.set('amountToman', i);
    else if (mapped === 'walletName') index.set('walletName', i);
    else if (mapped === 'categoryName') index.set('categoryName', i);
    else if (mapped === 'note') index.set('note', i);
  });

  const required: (keyof ParsedCsvRow)[] = [
    'date',
    'type',
    'amountToman',
    'walletName',
    'categoryName',
  ];
  if (!required.every((key) => index.has(key))) return null;
  return index;
}

export function parseTransactionCsv(text: string): {
  rows: ParsedCsvRow[];
  errors: CsvLineError[];
} {
  const errors: CsvLineError[] = [];
  const rows: ParsedCsvRow[] = [];

  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows, errors: [{ lineNumber: 1, message: 'فایل خالی است.' }] };
  }

  const firstCells = parseCsvLine(lines[0]!);
  const headerIndex = mapHeaderIndex(firstCells);
  const dataLines = headerIndex ? lines.slice(1) : lines;
  const startLine = headerIndex ? 2 : 1;

  const readCell = (cells: string[], key: keyof ParsedCsvRow) => {
    if (headerIndex) {
      const idx = headerIndex.get(key);
      return idx == null ? '' : (cells[idx] ?? '');
    }
    const order: (keyof ParsedCsvRow)[] = [
      'date',
      'type',
      'amountToman',
      'walletName',
      'categoryName',
      'note',
    ];
    const idx = order.indexOf(key);
    return idx >= 0 ? (cells[idx] ?? '') : '';
  };

  if (dataLines.length > MAX_TRANSACTION_CSV_ROWS) {
    errors.push({
      lineNumber: startLine,
      message: `حداکثر ${MAX_TRANSACTION_CSV_ROWS} ردیف مجاز است.`,
    });
    return { rows, errors };
  }

  for (let i = 0; i < dataLines.length; i += 1) {
    const lineNumber = startLine + i;
    const cells = parseCsvLine(dataLines[i]!);
    const type = normalizeType(readCell(cells, 'type'));
    const amountToman = parseAmount(readCell(cells, 'amountToman'));
    const date = normalizeDate(readCell(cells, 'date'));
    const walletName = readCell(cells, 'walletName').trim();
    const categoryName = readCell(cells, 'categoryName').trim();
    const note = readCell(cells, 'note').trim();

    if (!type) {
      errors.push({ lineNumber, message: 'نوع تراکنش نامعتبر است (income/expense).' });
      continue;
    }
    if (amountToman == null) {
      errors.push({ lineNumber, message: 'مبلغ نامعتبر است.' });
      continue;
    }
    if (!date) {
      errors.push({ lineNumber, message: 'تاریخ نامعتبر است.' });
      continue;
    }
    if (!walletName) {
      errors.push({ lineNumber, message: 'نام کیف پول خالی است.' });
      continue;
    }
    if (!categoryName) {
      errors.push({ lineNumber, message: 'نام دسته خالی است.' });
      continue;
    }

    rows.push({
      lineNumber,
      date,
      type,
      amountToman,
      walletName,
      categoryName,
      note,
    });
  }

  return { rows, errors };
}
