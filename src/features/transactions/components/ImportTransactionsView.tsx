'use client';

import {
  FormSection,
  ListGroup,
  ListRow,
  Money,
  PageHeader,
  PrimaryButton,
  Section,
  StickyFooter,
} from '@/shared/components/ui';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileUp, Upload } from 'lucide-react';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { Transaction, Wallet } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { downloadCsv } from '@/shared/utils/download-csv';
import { fireExpenseAlert } from '@/features/notifications/client/fire-expense-alert';
import {
  MAX_TRANSACTION_CSV_ROWS,
  parseTransactionCsv,
  TRANSACTION_CSV_TEMPLATE,
  type ParsedCsvRow,
} from '@/features/transactions/utils/parse-transaction-csv';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import {
  buildWalletImportPayload,
  resolveImportRows,
} from '@/features/transactions/utils/import-transaction-payload';

export function ImportTransactionsView() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { wallets, categories, currencyRates, setTransactions } = useData();
  const { usdRate } = useUI();
  const rateHistories = useRateHistories();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<Array<{ lineNumber: number; message: string }>>(
    []
  );
  const [isImporting, setIsImporting] = useState(false);

  const resolution = useMemo(
    () => resolveImportRows(parsedRows, wallets, categories),
    [parsedRows, wallets, categories]
  );

  const allErrors = useMemo(
    () => [...parseErrors, ...resolution.errors],
    [parseErrors, resolution.errors]
  );

  const walletById = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.id, wallet])),
    [wallets]
  );

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = parseTransactionCsv(text);
    setFileName(file.name);
    setParsedRows(result.rows);
    setParseErrors(result.errors);
  };

  const downloadTemplate = () => {
    downloadCsv('kharjook-transactions-template.csv', TRANSACTION_CSV_TEMPLATE.trim());
  };

  const handleImport = async () => {
    if (!user) {
      toast.error('کاربر معتبر نیست.');
      return;
    }
    if (resolution.resolved.length === 0) {
      toast.error('ردیف معتبری برای ثبت نیست.');
      return;
    }
    if (allErrors.length > 0) {
      toast.error('ابتدا خطاهای CSV را برطرف کنید.');
      return;
    }
    if (!(usdRate > 0)) {
      toast.error('نرخ دلار ثبت نشده — از بخش قیمت‌ها نرخ را تنظیم کنید.');
      return;
    }

    const operationId = crypto.randomUUID();
    const payloads: Record<string, unknown>[] = [];

    for (const row of resolution.resolved) {
      const wallet = walletById.get(row.walletId) as Wallet | undefined;
      if (!wallet) continue;
      const payload = buildWalletImportPayload({
        userId: user.id,
        operationId,
        row,
        wallet,
        usdRate,
        currencyRates,
        histories: rateHistories,
        todayStr: formatJalaali(todayJalaali()),
      });
      if (payload) payloads.push(payload);
    }

    if (payloads.length === 0) {
      toast.error('ساخت payload ناموفق بود.');
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await supabase.from('transactions').insert(payloads).select();
      if (error) throw error;

      const inserted = (data ?? []) as Transaction[];
      setTransactions((prev) => [...inserted, ...prev]);

      const expenseIds = inserted.filter((tx) => tx.type === 'EXPENSE').map((tx) => tx.id);
      fireExpenseAlert(expenseIds);

      toast.success(`${inserted.length.toLocaleString('fa-IR')} تراکنش ثبت شد.`);
      router.push('/wallets');
    } catch (error) {
      console.error(error);
      toast.error('خطا در ثبت دسته‌ای تراکنش‌ها.');
    } finally {
      setIsImporting(false);
    }
  };

  const columns = ['date', 'type', 'amount', 'wallet', 'category', 'note'];
  const canImport = !isImporting && resolution.resolved.length > 0 && allErrors.length === 0;

  return (
    <div className="bg-surface-shell min-h-full animate-[slide-fade-in-up_300ms_ease-out]">
      <PageHeader title="ورود CSV" subtitle="ثبت دسته‌ای درآمد و هزینه" />

      <div className="px-4 pt-5 space-y-6">
        <FormSection title="۱. قالب فایل">
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {columns.map((c) => (
              <span key={c} className="rounded-md bg-white/6 px-2 py-1 font-mono text-[11px] text-zinc-300">
                {c}
              </span>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            فقط درآمد و هزینه کیف پول، حداکثر {MAX_TRANSACTION_CSV_ROWS.toLocaleString('fa-IR')} ردیف. مبلغ به
            تومان است و نام کیف پول و دسته باید با اپ یکی باشد. همه ردیف‌ها یک{' '}
            <span dir="ltr">operation_id</span> مشترک می‌گیرند.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/6 px-3.5 text-xs font-medium text-zinc-200 hover:bg-white/10"
          >
            <Download size={14} />
            دانلود فایل نمونه
          </button>
        </FormSection>

        <FormSection title="۲. انتخاب فایل">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-surface-inset py-8 text-center transition-colors hover:bg-surface-hover"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-zinc-300">
              {fileName ? <FileUp size={20} /> : <Upload size={20} />}
            </span>
            <span className="text-sm font-medium text-zinc-100">{fileName ?? 'فایل CSV را انتخاب کن'}</span>
            <span className="text-xs text-zinc-500">{fileName ? 'برای تغییر فایل بزن' : '.csv'}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </FormSection>

        {allErrors.length > 0 && (
          <div className="space-y-1.5 rounded-2xl bg-rose-500/10 p-4">
            <p className="text-sm font-semibold text-rose-200">
              {allErrors.length.toLocaleString('fa-IR')} خطا — اول این‌ها را در فایل درست کن
            </p>
            {allErrors.slice(0, 8).map((err) => (
              <p key={`${err.lineNumber}-${err.message}`} className="text-xs text-rose-100/90">
                ردیف {err.lineNumber.toLocaleString('fa-IR')}: {err.message}
              </p>
            ))}
            {allErrors.length > 8 && (
              <p className="text-[11px] text-rose-300/80">و {allErrors.length - 8} خطای دیگر…</p>
            )}
          </div>
        )}

        {resolution.resolved.length > 0 && (
          <Section
            title="۳. پیش‌نمایش"
            description={`${resolution.resolved.length.toLocaleString('fa-IR')} ردیف آماده ثبت`}
          >
            <ListGroup>
              {resolution.resolved.slice(0, 20).map((row) => (
                <ListRow
                  key={row.lineNumber}
                  title={`${row.type === 'INCOME' ? 'درآمد' : 'هزینه'} · ${row.categoryName}`}
                  subtitle={`${row.date} · ${row.walletName}${row.note ? ` · ${row.note}` : ''}`}
                  trailing={
                    <Money tone={row.type === 'INCOME' ? 'positive' : 'negative'}>
                      {row.type === 'INCOME' ? '+' : '−'}
                      {formatCurrency(row.amountToman, 'TOMAN')}
                    </Money>
                  }
                />
              ))}
            </ListGroup>
            {resolution.resolved.length > 20 && (
              <p className="px-1 text-xs text-zinc-500">
                و {(resolution.resolved.length - 20).toLocaleString('fa-IR')} ردیف دیگر
              </p>
            )}
          </Section>
        )}

        <StickyFooter>
          <PrimaryButton disabled={!canImport} onClick={() => void handleImport()}>
            {isImporting
              ? 'در حال ثبت…'
              : resolution.resolved.length > 0
                ? `ثبت ${resolution.resolved.length.toLocaleString('fa-IR')} تراکنش`
                : 'اول فایل را انتخاب کن'}
          </PrimaryButton>
        </StickyFooter>
      </div>
    </div>
  );
}
