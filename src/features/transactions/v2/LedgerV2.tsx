'use client';

/**
 * v2 ledger (UX plan §3, S15–S16).
 * Grouped by day with daily totals · search · type / period / wallet
 * filters · swipe (edit, duplicate, delete with undo) · long press to
 * select many (change category, export, delete) · progressive loading.
 * Every v1 feature stays: search, type filter, date range, CSV export,
 * edit, convert pairs, "loading full history" note.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Amount,
  Avatar,
  Banner,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  DateField,
  EmptyState,
  Field,
  IconButton,
  InputChip,
  List,
  ListHeader,
  ListRow,
  PickerSheet,
  SearchField,
  Sheet,
  SkeletonList,
  Spinner,
  SwipeRow,
  Text,
  useLongPress,
} from '@/design-system';
import { ArrowLeftRight, Coins, Copy, Download, Pencil, Receipt, RefreshCw, Trash2, X } from '@/design-system/icons';
import type { Transaction } from '@/shared/types/domain';
import { addDays, formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { currentPeriod, shiftPeriod } from '@/shared/utils/period';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { groupConvertTransactions, transactionIdsInConvertGroups, type ConvertTransactionGroup } from '@/features/transactions/utils/convert-transaction';
import { transactionMatchesSearch } from '@/features/transactions/utils/transaction-history-search';
import { downloadTransactionCsv } from '@/features/transactions/utils/export-transaction-csv';
import { describeTransaction, netToman, type TransactionRowView } from '@/features/transactions/utils/describe-transaction';
import { useTransactionActions } from '@/features/transactions/hooks/use-transaction-actions';
import { categoryIcon } from './category-icon';
import { useQueuedCount } from '@/features/transactions/components/OutboxSync';
import { collectDescendantCategoryIds } from '@/features/categories/utils/category-spending-caps';

type TypeFilter = 'ALL' | 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'BUY' | 'SELL';
type PeriodFilter = 'month' | 'prev' | '3m' | 'year' | 'all' | 'custom';

const TYPE_CHIPS: [TypeFilter, string][] = [
  ['ALL', 'همه'],
  ['EXPENSE', 'هزینه'],
  ['INCOME', 'درآمد'],
  ['TRANSFER', 'انتقال'],
  ['BUY', 'خرید'],
  ['SELL', 'فروش'],
];
const PERIOD_CHIPS: [PeriodFilter, string][] = [
  ['month', 'این ماه'],
  ['prev', 'ماه قبل'],
  ['3m', '۳ ماه'],
  ['year', 'امسال'],
  ['all', 'همه'],
  ['custom', 'بازه دلخواه'],
];
const TINTS = ['peach', 'mint', 'sky', 'lemon', 'lilac', 'rose'] as const;
const PAGE = 60;

type Item =
  | { kind: 'single'; key: string; date: string; created: string; tx: Transaction; view: TransactionRowView }
  | { kind: 'convert'; key: string; date: string; created: string; group: ConvertTransactionGroup };

function tintFor(id: string | null) {
  if (!id) return 'lilac' as const;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

function dayLabel(date: string, today: string, yesterday: string) {
  if (date === today) return 'امروز';
  if (date === yesterday) return 'دیروز';
  const d = parseJalaali(date);
  return d ? formatJalaaliHuman(d) : date;
}

export function LedgerV2() {
  const router = useRouter();
  const { transactions, wallets, assets, persons, categories, isLoadingData, transactionsFullyLoaded } = useData();
  const actions = useTransactionActions();
  const queued = useQueuedCount();

  // Filters can come from the URL (search, report drill-down).
  const params = useSearchParams();
  const urlType = params.get('type');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [type, setType] = useState<TypeFilter>(TYPE_CHIPS.some(([t]) => t === urlType) ? (urlType as TypeFilter) : 'ALL');
  const [period, setPeriod] = useState<PeriodFilter>(params.get('from') || params.get('to') ? 'custom' : params.get('category') ? 'all' : 'month');
  const [walletId, setWalletId] = useState<string | null>(params.get('wallet'));
  const [categoryId, setCategoryId] = useState<string | null>(params.get('category'));
  const [walletPicker, setWalletPicker] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const today = useMemo(() => formatJalaali(todayJalaali()), []);
  const yesterday = useMemo(() => formatJalaali(addDays(todayJalaali(), -1)), []);
  const [customFrom, setCustomFrom] = useState(params.get('from') ?? formatJalaali(currentPeriod('month').start));
  const [customTo, setCustomTo] = useState(params.get('to') ?? today);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categorySheet, setCategorySheet] = useState(false);
  // Paging resets when filters change (no effect: keyed by the filter state).
  const [paging, setPaging] = useState<{ key: string; count: number }>({ key: '', count: PAGE });
  const selecting = selected.size > 0;

  const range = useMemo((): { from: string; to: string } => {
    const month = currentPeriod('month');
    switch (period) {
      case 'month':
        return { from: formatJalaali(month.start), to: today };
      case 'prev': {
        const p = shiftPeriod(month, -1);
        return { from: formatJalaali(p.start), to: formatJalaali(p.end) };
      }
      case '3m':
        return { from: formatJalaali(shiftPeriod(month, -2).start), to: today };
      case 'year':
        return { from: formatJalaali(currentPeriod('year').start), to: today };
      case 'all':
        return { from: '', to: '' };
      case 'custom':
        return { from: customFrom, to: customTo };
      default:
        return { from: formatJalaali(month.start), to: today };
    }
  }, [period, customFrom, customTo, today]);

  const lookup = useMemo(() => ({ wallets, assets, persons, categories }), [wallets, assets, persons, categories]);
  // A category filter includes its sub-categories.
  const categoryIds = useMemo(
    () =>
      categoryId
        ? collectDescendantCategoryIds(categories, categoryId, categories.find((c) => c.id === categoryId)?.kind ?? 'expense')
        : null,
    [categoryId, categories]
  );
  const categoryName = categoryId ? categories.find((c) => c.id === categoryId)?.name ?? 'دسته' : null;

  const items = useMemo((): Item[] => {
    const inRange = (d: string) => (!range.from || d >= range.from) && (!range.to || d <= range.to);
    const touchesWallet = (t: Transaction) => !walletId || t.source_wallet_id === walletId || t.target_wallet_id === walletId;
    const inCategory = (t: Transaction) => !categoryIds || (t.category_id != null && categoryIds.has(t.category_id));
    const convertIds = transactionIdsInConvertGroups(transactions);
    const singles: Item[] = transactions
      .filter((t) => !convertIds.has(t.id))
      .filter((t) => type === 'ALL' || t.type === type)
      .filter((t) => inRange(t.date_string) && touchesWallet(t) && inCategory(t))
      .filter((t) => transactionMatchesSearch(t, query, lookup))
      .map((t) => ({ kind: 'single', key: t.id, date: t.date_string, created: t.created_at, tx: t, view: describeTransaction(t, lookup) }));
    const converts: Item[] = groupConvertTransactions(transactions)
      .filter(() => type === 'ALL' || type === 'BUY' || type === 'SELL')
      .filter((g) => !categoryIds && inRange(g.sell.date_string) && (touchesWallet(g.sell) || touchesWallet(g.buy)))
      .filter((g) => !query.trim() || `${g.sell.note ?? ''} ${g.buy.note ?? ''}`.includes(query.trim()) || transactionMatchesSearch(g.sell, query, lookup) || transactionMatchesSearch(g.buy, query, lookup))
      .map((g) => ({ kind: 'convert', key: `c:${g.operationId}`, date: g.sell.date_string, created: g.sell.created_at, group: g }));
    return [...singles, ...converts].sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created));
  }, [transactions, type, range, walletId, query, lookup, categoryIds]);

  const rowsOf = (it: Item): Transaction[] => (it.kind === 'single' ? [it.tx] : [it.group.sell, it.group.buy]);
  const summary = useMemo(() => netToman(items.flatMap(rowsOf)), [items]);

  const filterKey = [type, period, walletId, query, customFrom, customTo, categoryId].join('|');
  const visible = paging.key === filterKey ? paging.count : PAGE;
  const setVisible = (update: (v: number) => number) => setPaging({ key: filterKey, count: update(visible) });
  const filterKeyRef = useRef(filterKey);
  useEffect(() => {
    filterKeyRef.current = filterKey;
  }, [filterKey]);

  // Auto load more when the sentinel is visible.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      const key = filterKeyRef.current;
      setPaging((p) => ({ key, count: (p.key === key ? p.count : PAGE) + PAGE }));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length]);

  const shown = items.slice(0, visible);
  const groups = useMemo(() => {
    const out: { date: string; items: Item[] }[] = [];
    for (const it of shown) {
      const last = out[out.length - 1];
      if (last && last.date === it.date) last.items.push(it);
      else out.push({ date: it.date, items: [it] });
    }
    return out;
  }, [shown]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const selectedRows = items.filter((it) => selected.has(it.key)).flatMap(rowsOf);

  if (isLoadingData && transactions.length === 0) {
    return (
      <div className="px-(--ds-gutter) pt-2">
        <SkeletonList rows={6} />
      </div>
    );
  }

  const walletName = walletId ? wallets.find((w) => w.id === walletId)?.name : null;
  const exportRows = selecting ? selectedRows : items.flatMap(rowsOf);

  return (
    <div className="space-y-4 px-(--ds-gutter) pt-1 pb-6">
      <div className="flex items-center gap-2">
        <SearchField value={query} onValueChange={setQuery} placeholder="جستجو در یادداشت، دسته، مبلغ…" className="flex-1" />
        <IconButton
          aria-label="خروجی CSV"
          variant="secondary"
          icon={<Download />}
          disabled={exportRows.length === 0}
          onClick={() => downloadTransactionCsv(exportRows, wallets, assets, categories)}
        />
      </div>

      <div className="space-y-2">
        <ChipGroup aria-label="نوع" value={[type]} onValueChange={(v) => v[0] && setType(v[0] as TypeFilter)}>
          {TYPE_CHIPS.map(([v, label]) => (
            <Chip key={v} value={v}>
              {label}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup
          aria-label="بازه"
          value={[period]}
          onValueChange={(v) => {
            const next = v[0];
            // The wallet chip lives in this row but is not a period.
            if (!next || !PERIOD_CHIPS.some(([p]) => p === next)) return;
            setPeriod(next as PeriodFilter);
            if (next === 'custom') setRangeOpen(true);
          }}
        >
          {PERIOD_CHIPS.map(([v, label]) => (
            <Chip key={v} value={v}>
              {label}
            </Chip>
          ))}
          <Chip value="__wallet" pressed={Boolean(walletId)} onPressedChange={() => setWalletPicker(true)}>
            {walletName ?? 'همه کیف پول‌ها'}
          </Chip>
        </ChipGroup>
      </div>

      {categoryName && (
        <div className="flex">
          <InputChip onRemove={() => setCategoryId(null)} removeLabel="حذف فیلتر دسته">
            دسته: {categoryName}
          </InputChip>
        </div>
      )}

      {period === 'custom' && (
        <button type="button" onClick={() => setRangeOpen(true)} className="ds-focus text-caption text-accent-ink">
          از {range.from || '—'} تا {range.to || '—'} · تغییر
        </button>
      )}

      <div className="grid grid-cols-3 gap-2 rounded-card bg-panel p-3 text-center">
        <div>
          <p className="text-micro text-fg-subtle">درآمد</p>
          <Amount value={summary.income} size="xs" compact tone="positive" />
        </div>
        <div>
          <p className="text-micro text-fg-subtle">هزینه</p>
          <Amount value={summary.expense} size="xs" compact tone="negative" />
        </div>
        <div>
          <p className="text-micro text-fg-subtle">خالص</p>
          <Amount value={summary.income - summary.expense} size="xs" compact tone="auto" signed />
        </div>
        {summary.unpriced > 0 && (
          <p className="col-span-3 text-micro text-fg-subtle">{summary.unpriced.toLocaleString('fa-IR')} تراکنش بدون نرخ در جمع نیامده</p>
        )}
      </div>

      {queued > 0 && (
        <Banner tone="info" title={`${queued.toLocaleString('fa-IR')} تراکنش در صف ارسال`}>
          بدون اینترنت ثبت شده؛ با برگشت اینترنت خودکار ارسال می‌شود.
        </Banner>
      )}

      {!transactionsFullyLoaded && (
        <p className="flex items-center gap-2 text-caption text-fg-subtle">
          <Spinner size="sm" /> در حال بارگذاری تاریخچه کامل…
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-card bg-panel">
          <EmptyState
            icon={<Receipt />}
            title={transactions.length === 0 ? 'هنوز تراکنشی ثبت نشده' : 'تراکنشی با این فیلتر پیدا نشد'}
            description={transactions.length === 0 ? 'اولین هزینه یا درآمدت را ثبت کن.' : 'بازه یا نوع را تغییر بده.'}
            action={
              transactions.length === 0 ? (
                <Button onClick={() => router.push('/transactions/new?type=EXPENSE')}>ثبت تراکنش</Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setType('ALL');
                    setPeriod('all');
                    setWalletId(null);
                    setQuery('');
                  }}
                >
                  پاک کردن فیلترها
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-1">
          {groups.map((g) => {
            const net = netToman(g.items.flatMap(rowsOf));
            return (
              <section key={g.date} aria-label={dayLabel(g.date, today, yesterday)}>
                <ListHeader trailing={net.income || net.expense ? <Amount value={net.income - net.expense} size="xs" tone="muted" signed compact /> : null}>
                  {dayLabel(g.date, today, yesterday)}
                </ListHeader>
                <List>
                  {g.items.map((it) => (
                    <li key={it.key}>
                      <LedgerRow
                        item={it}
                        selecting={selecting}
                        checked={selected.has(it.key)}
                        onToggle={() => toggle(it.key)}
                        onOpen={() => router.push(`/transactions/${it.kind === 'single' ? it.tx.id : it.group.sell.id}/edit`)}
                        onDuplicate={it.kind === 'single' ? () => void actions.duplicate(it.tx) : undefined}
                        onDelete={() => void actions.remove(rowsOf(it))}
                        assetsName={(id) => assets.find((a) => a.id === id)?.name ?? 'دارایی'}
                      />
                    </li>
                  ))}
                </List>
              </section>
            );
          })}
          {visible < items.length && (
            <div ref={sentinel} className="flex justify-center py-4">
              <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                نمایش بیشتر ({(items.length - visible).toLocaleString('fa-IR')})
              </Button>
            </div>
          )}
        </div>
      )}

      {selecting && (
        <div
          role="toolbar"
          aria-label="کارهای گروهی"
          className="fixed inset-x-0 bottom-[calc(var(--ds-tabbar-height)+env(safe-area-inset-bottom,0px)+0.5rem)] z-(--ds-z-nav) mx-auto flex w-[calc(100%-2rem)] max-w-(--ds-max-width) items-center gap-1 rounded-full bg-elevated p-1.5 shadow-overlay"
        >
          <IconButton aria-label="لغو انتخاب" icon={<X />} size="sm" onClick={() => setSelected(new Set())} />
          <Text variant="caption" weight="semibold" className="flex-1" render={<span />}>
            {selected.size.toLocaleString('fa-IR')} انتخاب
          </Text>
          <Button size="sm" variant="ghost" onClick={() => setCategorySheet(true)}>
            دسته‌بندی
          </Button>
          <IconButton aria-label="خروجی انتخاب‌شده‌ها" icon={<Download />} size="sm" onClick={() => downloadTransactionCsv(selectedRows, wallets, assets, categories)} />
          <IconButton
            aria-label="حذف انتخاب‌شده‌ها"
            icon={<Trash2 />}
            size="sm"
            variant="danger"
            onClick={() => void actions.remove(selectedRows).then((ok) => ok && setSelected(new Set()))}
          />
        </div>
      )}

      <PickerSheet
        open={walletPicker}
        onOpenChange={setWalletPicker}
        title="فیلتر کیف پول"
        value={walletId ?? '__all'}
        onValueChange={(v) => setWalletId(v === '__all' ? null : v)}
        options={[{ value: '__all', label: 'همه کیف پول‌ها' }, ...wallets.map((w) => ({ value: w.id, label: w.name, description: w.currency }))]}
      />

      <Sheet
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        title="بازه دلخواه"
        footer={
          <Button fullWidth size="lg" onClick={() => setRangeOpen(false)}>
            اعمال
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="از تاریخ">
            <DateField value={customFrom} onValueChange={setCustomFrom} quickChips={false} />
          </Field>
          <Field label="تا تاریخ">
            <DateField value={customTo} onValueChange={setCustomTo} quickChips={false} />
          </Field>
        </div>
      </Sheet>

      <CategorySheetPicker
        open={categorySheet}
        onClose={() => setCategorySheet(false)}
        title="دسته‌بندی برای انتخاب‌شده‌ها"
        kind={selectedRows.every((r) => r.type === 'INCOME') ? 'income' : 'expense'}
        categories={categories}
        value={null}
        onSelect={(id) => {
          setCategorySheet(false);
          if (id) void actions.setCategory(selectedRows, id).then(() => setSelected(new Set()));
        }}
      />
    </div>
  );
}

function LedgerRow({
  item,
  selecting,
  checked,
  onToggle,
  onOpen,
  onDuplicate,
  onDelete,
  assetsName,
}: {
  item: Item;
  selecting: boolean;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  assetsName: (id: string | null) => string;
}) {
  const press = useLongPress({ onLongPress: onToggle, onPress: selecting ? onToggle : onOpen });

  let leading;
  let title: string;
  let subtitle: string;
  let trailing;
  if (item.kind === 'convert') {
    const { sell, buy } = item.group;
    leading = <Avatar tone="lilac" fallback={<RefreshCw />} />;
    title = `تبدیل ${assetsName(sell.source_asset_id ?? sell.asset_id)} به ${assetsName(buy.target_asset_id ?? buy.asset_id)}`;
    subtitle = 'فروش و خرید هم‌زمان';
    trailing = <Amount value={Number(sell.amount_toman_at_time ?? 0)} size="sm" compact />;
  } else {
    const v = item.view;
    const tx = item.tx;
    leading =
      tx.type === 'TRANSFER' ? (
        <Avatar tone="sky" fallback={<ArrowLeftRight />} />
      ) : tx.type === 'BUY' || tx.type === 'SELL' ? (
        <Avatar tone="lemon" fallback={<Coins />} />
      ) : (
        <Avatar tone={tintFor(tx.category_id)} fallback={categoryIcon(v.categoryName ?? '')} />
      );
    title = v.title;
    subtitle = v.subtitle;
    trailing =
      typeof v.unit === 'object' ? (
        <span className="tabular text-callout">
          {v.amount.toLocaleString('fa-IR', { maximumFractionDigits: 6 })} {v.unit.asset}
        </span>
      ) : (
        <Amount
          value={v.direction === -1 ? -v.amount : v.amount}
          currency={v.unit}
          size="sm"
          tone={v.direction === 0 ? 'default' : 'auto'}
          signed={v.direction === 1}
        />
      );
  }

  const row = (
    <ListRow
      asListItem={false}
      chevron={false}
      leading={selecting ? <Checkbox checked={checked} aria-label="انتخاب" /> : leading}
      title={title}
      subtitle={subtitle}
      trailing={trailing}
      {...press}
      onClick={press.onClick as never}
      className={checked ? 'bg-accent-soft' : undefined}
    />
  );

  if (selecting) return row;
  return (
    <SwipeRow
      actions={[
        { key: 'edit', label: 'ویرایش', icon: <Pencil />, tone: 'neutral', onAction: onOpen },
        ...(onDuplicate ? [{ key: 'dup', label: 'تکرار', icon: <Copy />, tone: 'accent' as const, onAction: onDuplicate }] : []),
        { key: 'del', label: 'حذف', icon: <Trash2 />, tone: 'negative', onAction: onDelete },
      ]}
    >
      {row}
    </SwipeRow>
  );
}
