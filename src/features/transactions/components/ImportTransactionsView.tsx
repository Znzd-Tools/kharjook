'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Download, FileUp, Upload } from 'lucide-react';
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

  return (
    <div className="bg-[#0F1015] min-h-full pb-24 animate-[slide-fade-in-up_300ms_ease-out]">
      <div className="sticky top-0 bg-[#161722]/90 backdrop-blur-md px-6 py-4 flex items-center gap-4 border-b border-white/5 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 -mr-2 bg-white/5 rounded-full text-slate-300 hover:bg-white/10"
        >
          <ArrowRight size={20} />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">ورود CSV تراکنش</h2>
      </div>

      <div className="p-6 space-y-5">
        <div className="bg-[#1A1B26] border border-white/5 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            فایل CSV با ستون‌های{' '}
            <span className="text-purple-300 font-mono text-xs" dir="ltr">
              date,type,amount,wallet,category,note
            </span>{' '}
            — فقط درآمد/هزینه کیف پول. حداکثر {MAX_TRANSACTION_CSV_ROWS.toLocaleString('fa-IR')}{' '}
            ردیف.
          </p>
          <p className="text-[11px] text-slate-500">
            مبلغ به تومان است. نام کیف و دسته باید با اپ یکی باشد. همه ردیف‌ها یک{' '}
            <span dir="ltr">operation_id</span> مشترک می‌گیرند.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10"
            >
              <Download size={14} />
              دانلود نمونه
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-xs text-purple-200 hover:bg-purple-600/30"
            >
              <Upload size={14} />
              انتخاب فایل
            </button>
          </div>
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
          {fileName && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <FileUp size={12} />
              {fileName}
            </p>
          )}
        </div>

        {allErrors.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-rose-200">خطاها</p>
            {allErrors.slice(0, 8).map((err) => (
              <p key={`${err.lineNumber}-${err.message}`} className="text-[11px] text-rose-100/90">
                ردیف {err.lineNumber.toLocaleString('fa-IR')}: {err.message}
              </p>
            ))}
            {allErrors.length > 8 && (
              <p className="text-[10px] text-rose-300/80">
                و {allErrors.length - 8} خطای دیگر…
              </p>
            )}
          </div>
        )}

        {resolution.resolved.length > 0 && (
          <div className="bg-[#1A1B26] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <p className="text-sm font-bold text-white">پیش‌نمایش</p>
              <span className="text-[11px] text-slate-500">
                {resolution.resolved.length.toLocaleString('fa-IR')} ردیف
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
              {resolution.resolved.slice(0, 20).map((row) => (
                <div key={row.lineNumber} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-200 truncate">
                      {row.type === 'INCOME' ? 'درآمد' : 'هزینه'} · {row.categoryName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {row.date} · {row.walletName}
                      {row.note ? ` · ${row.note}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold shrink-0 ${
                      row.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                    dir="ltr"
                  >
                    {formatCurrency(row.amountToman, 'TOMAN')}
                  </span>
                </div>
              ))}
            </div>
            {resolution.resolved.length > 20 && (
              <p className="px-4 py-2 text-[10px] text-slate-500 border-t border-white/5">
                … و {(resolution.resolved.length - 20).toLocaleString('fa-IR')} ردیف دیگر
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={
            isImporting ||
            resolution.resolved.length === 0 ||
            allErrors.length > 0
          }
          onClick={() => void handleImport()}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {isImporting
            ? 'در حال ثبت…'
            : `ثبت ${resolution.resolved.length.toLocaleString('fa-IR')} تراکنش`}
        </button>
      </div>
    </div>
  );
}
