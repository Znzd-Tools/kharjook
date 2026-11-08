'use client';

/**
 * Dashboard v2 (UX plan §9). Ten blocks, each answers one question.
 * Every v1 widget lives on as a block or inside one (§9.4). Numbers come
 * from the same code as v1 (useHomeStats, PnL summary, timeline).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  AllocationBar,
  Amount,
  Avatar,
  Badge,
  Banner,
  BarChart,
  Button,
  Card,
  Chip,
  ChipGroup,
  Delta,
  IconButton,
  List,
  ListRow,
  ProgressBar,
  Section,
  SegmentedControl,
  Sheet,
  Sparkline,
  Switch,
  Text,
  formatMoney,
  toast,
} from '@/design-system';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpLeft,
  ChevronDown,
  Coins,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  Percent,
  RefreshCw,
  Settings,
  Zap,
} from '@/design-system/icons';
import { addDays, formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { clampPeriodToToday, currentPeriod } from '@/shared/utils/period';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { useHomeStats } from '@/features/dashboard/hooks/use-home-stats';
import { buildSparklineDateStrings, portfolioTotalTomanAtDate } from '@/features/dashboard/utils/portfolio-history';
import { buildYearCashflowByMonth } from '@/features/dashboard/utils/year-cashflow';
import {
  avgMonthlyExpense,
  idleCash,
  monthProgress,
  runwayMonths,
  savingsRate,
  spendVsLastMonth,
  todayMarketMove,
  topMovers,
} from '@/features/dashboard/utils/insights';
import { GoalsDriftWidget } from '@/features/dashboard/components/GoalsDriftWidget';
import { buildCapStatuses } from '@/features/categories/utils/category-spending-caps';
import { buildTimeline, daysLeftLabel } from '@/features/deadlines/utils/timeline';
import { useSettleDeadline } from '@/features/deadlines/hooks/use-settle-deadline';
import { rankEndpoints, frequentPatterns } from '@/features/transactions/utils/usage-stats';
import { PortfolioPnlCard } from '@/features/pnl/components/PortfolioPnlCard';
import { buildPnlSummary } from '@/features/pnl/utils/pnl-summary';
import { netWorthChangeThisMonth } from '@/features/pnl/utils/net-worth-change';
import { BLOCKS, moveBlock, type BlockKey } from './blocks';
import { useDashboardLayout } from './use-dashboard-layout';

const PRIVACY_KEY = 'kj_privacy';
const privacyListeners = new Set<() => void>();
function readPrivacy() {
  try {
    return window.localStorage.getItem(PRIVACY_KEY) === '1';
  } catch {
    return false;
  }
}
function setPrivacy(on: boolean) {
  try {
    window.localStorage.setItem(PRIVACY_KEY, on ? '1' : '0');
  } catch {
    // storage blocked
  }
  privacyListeners.forEach((l) => l());
}
function usePrivacy() {
  return useSyncExternalStore(
    (l) => {
      privacyListeners.add(l);
      return () => privacyListeners.delete(l);
    },
    readPrivacy,
    () => false
  );
}

export function HomeV2() {
  const router = useRouter();
  const data = useData();
  const {
    assets, transactions, wallets, currencyRates, dailyPrices, spendingCaps, categories, checks,
    activeSubscriptions, upcomingDeadlines, dataFetchError, refresh, refreshAll,
  } = data;
  const { currencyMode, usdRate, usdRateIsSet, toggleCurrency } = useUI();
  const rateHistories = useRateHistories();
  const stats = useHomeStats();
  const hidden = usePrivacy();
  const { layout, save } = useDashboardLayout();
  const [editOpen, setEditOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allocView, setAllocView] = useState<'groups' | 'assets'>('groups');
  const { pay, busyKey } = useSettleDeadline();

  const today = useMemo(() => todayJalaali(), []);
  const todayStr = formatJalaali(today);
  const usd = currencyMode === 'USD';
  const toDisplay = (toman: number) => (usd ? (usdRate > 0 ? toman / usdRate : 0) : toman);
  const cur = usd ? 'USD' : 'TOMAN';

  /* ----------------------------- numbers ----------------------------- */

  const history = useMemo(() => {
    const at = (d: string) => portfolioTotalTomanAtDate(assets, transactions, wallets, dailyPrices, currencyRates, todayStr, d).totalToman;
    const dates = buildSparklineDateStrings('30d', today, todayStr, 10);
    const points = dates.map(at);
    return { points };
  }, [assets, transactions, wallets, dailyPrices, currencyRates, today, todayStr]);
  // Today = price moves of what you hold, fresh prices only.
  const todayChange = useMemo(() => todayMarketMove(assets, transactions, dailyPrices, usdRate, today), [assets, transactions, dailyPrices, usdRate, today]);

  const pnl = useMemo(() => buildPnlSummary(assets, transactions, dailyPrices, usdRate, todayStr), [assets, transactions, dailyPrices, usdRate, todayStr]);
  const timeline = useMemo(
    () => buildTimeline({ checks, subscriptions: activeSubscriptions, installments: upcomingDeadlines }, today),
    [checks, activeSubscriptions, upcomingDeadlines, today]
  );
  const caps = useMemo(
    () => buildCapStatuses({ caps: spendingCaps, categories, transactions, period: clampPeriodToToday(currentPeriod('month')) }),
    [spendingCaps, categories, transactions]
  );
  const avgExpense = useMemo(() => avgMonthlyExpense(transactions, today), [transactions, today]);
  const pace = useMemo(() => spendVsLastMonth(transactions, today), [transactions, today]);
  const worth = useMemo(
    () => netWorthChangeThisMonth({ assets, transactions, wallets, dailyPrices, currencyRates }, today),
    [assets, transactions, wallets, dailyPrices, currencyRates, today]
  );
  const movers = useMemo(() => topMovers(assets, transactions, dailyPrices, usdRate, today), [assets, transactions, dailyPrices, usdRate, today]);
  const yearFlow = useMemo(
    () => buildYearCashflowByMonth(transactions, wallets, currencyRates, 'TOMAN', usdRate, rateHistories),
    [transactions, wallets, currencyRates, usdRate, rateHistories]
  );
  const frequent = useMemo(() => frequentPatterns(transactions, formatJalaali(addDays(today, -120))), [transactions, today]);

  const assetsToman = Math.max(0, stats.totalPortfolioToman - stats.cashToman);
  const runway = runwayMonths(stats.cashToman, avgExpense);
  const rate = savingsRate(stats.monthIncomeToman, stats.monthExpenseToman);
  const idle = idleCash(stats.cashToman, avgExpense);
  const overdue = timeline.filter((i) => i.bucket === 'overdue');
  const soon = timeline.filter((i) => i.bucket === 'overdue' || i.bucket === 'week').slice(0, 3);
  const defaultWallet = rankEndpoints(transactions, 'EXPENSE', 'source', ['wallet'])[0]?.id ?? wallets[0]?.id ?? null;

  const attention: { key: string; icon: ReactNode; text: string; href: string; tone: 'warning' | 'negative' }[] = [];
  if (!usdRateIsSet) attention.push({ key: 'usd', icon: <Percent />, text: 'نرخ دلار ثبت نشده', href: '/manage/rates', tone: 'warning' });
  if (stats.walletsMissingRate.length > 0)
    attention.push({ key: 'wrate', icon: <Percent />, text: `نرخ ارز ${stats.walletsMissingRate.map((w) => w.currency).join('، ')} ثبت نشده`, href: '/manage/rates', tone: 'warning' });
  if (pnl.missingPriceCount > 0)
    attention.push({ key: 'price', icon: <Coins />, text: `${pnl.missingPriceCount.toLocaleString('fa-IR')} دارایی قیمت ندارد`, href: '/prices', tone: 'warning' });
  if (overdue.length > 0)
    attention.push({ key: 'overdue', icon: <AlertTriangle />, text: `${overdue.length.toLocaleString('fa-IR')} سررسید گذشته`, href: '/deadlines', tone: 'negative' });
  for (const c of caps.filter((c) => c.level === 'over').slice(0, 2))
    attention.push({ key: `cap-${c.categoryId}`, icon: <AlertTriangle />, text: `هزینه «${c.categoryName}» از سقف گذشت`, href: '/manage/categories', tone: 'negative' });

  /* ------------------------------ blocks ------------------------------ */

  const blocks: Record<BlockKey, ReactNode> = {
    hero: (
      <Card variant="hero" padding="lg" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption text-fg-on-hero-muted">ارزش کل دارایی</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleCurrency}
              aria-label="تغییر واحد"
              className="ds-focus rounded-full bg-white/30 px-2.5 py-1 text-micro font-semibold backdrop-blur-sm"
            >
              {usd ? 'دلار' : 'تومان'}
            </button>
            <IconButton
              size="sm"
              aria-label={hidden ? 'نمایش مبالغ' : 'پنهان کردن مبالغ'}
              icon={hidden ? <EyeOff /> : <Eye />}
              className="text-fg-on-hero hover:bg-white/30"
              onClick={() => setPrivacy(!hidden)}
            />
          </div>
        </div>
        <Amount value={toDisplay(stats.totalPortfolioToman)} currency={cur} size="hero" tone="inherit" hidden={hidden} />
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-caption text-fg-on-hero-muted">
            <span className="rounded-full bg-white/30 px-2 py-0.5 font-semibold text-fg-on-hero">
              <Amount value={toDisplay(todayChange)} currency={cur} size="xs" compact signed tone="inherit" hidden={hidden} />
            </span>
            تغییر قیمت امروز
          </span>
          <Sparkline data={history.points} tone="muted" width={110} height={30} aria-label="روند ۳۰ روز ارزش کل" />
        </div>
        <div className="space-y-1.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-white/25" aria-hidden>
            <span className="h-full bg-fg-on-hero/70" style={{ width: `${stats.totalPortfolioToman > 0 ? (assetsToman / stats.totalPortfolioToman) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-between text-micro text-fg-on-hero-muted">
            <span>
              دارایی <Amount value={toDisplay(assetsToman)} currency={cur} size="xs" compact tone="inherit" hidden={hidden} />
            </span>
            <span>
              نقد <Amount value={toDisplay(stats.cashToman)} currency={cur} size="xs" compact tone="inherit" hidden={hidden} />
            </span>
          </div>
        </div>
      </Card>
    ),

    attention:
      attention.length > 0 ? (
        <Section title="نیاز به توجه">
          <List>
            {attention.map((a) => (
              <ListRow
                key={a.key}
                size="sm"
                render={<Link href={a.href} />}
                leading={<Avatar size="sm" tone={a.tone === 'negative' ? 'rose' : 'lemon'} fallback={a.icon} />}
                title={a.text}
              />
            ))}
          </List>
        </Section>
      ) : null,

    pnl: <PortfolioPnlCard />,

    month: (
      <Section title="این ماه" action={<Button size="sm" variant="link" render={<Link href="/reports/cashflow" />} nativeButton={false}>گزارش</Button>}>
        <div className="space-y-4 rounded-card bg-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={<ArrowDownLeft />} tint="mint" label="درآمد" value={<Amount value={toDisplay(stats.monthIncomeToman)} currency={cur} compact size="sm" hidden={hidden} />} />
            <MiniStat icon={<ArrowUpLeft />} tint="rose" label="هزینه" value={<Amount value={toDisplay(stats.monthExpenseToman)} currency={cur} compact size="sm" hidden={hidden} />} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
            <span className="text-fg-muted">
              بالانس ماه: <Amount value={toDisplay(stats.monthBalanceToman)} currency={cur} size="xs" compact tone="auto" signed hidden={hidden} />
            </span>
            {rate != null && <Badge tone={rate >= 0 ? 'positive' : 'negative'}>پس‌انداز {Math.round(rate).toLocaleString('fa-IR')}٪</Badge>}
          </div>
          {pace.change != null && (
            <p className="text-caption text-fg-subtle">
              تا امروز {Math.abs(Math.round(pace.change)).toLocaleString('fa-IR')}٪ {pace.change <= 0 ? 'کمتر' : 'بیشتر'} از ماه قبل تا همین روز خرج کرده‌ای.
            </p>
          )}
          {stats.maxExpenseToman && (
            <p className="text-caption text-fg-subtle">
              بیشترین هزینه: <span className="text-fg">{stats.maxExpenseToman.name}</span>{' '}
              <Amount value={toDisplay(stats.maxExpenseToman.value)} currency={cur} size="xs" compact hidden={hidden} />
            </p>
          )}
          {caps.slice(0, 3).map((c) => (
            <ProgressBar
              key={c.categoryId}
              tone="auto"
              value={c.spentToman}
              max={c.limitToman}
              marker={c.limitToman * monthProgress(today)}
              label={c.categoryName}
              valueLabel={`${Math.round(c.percent).toLocaleString('fa-IR')}٪`}
            />
          ))}
        </div>
      </Section>
    ),

    networth: (
      <Section title="تغییر ارزش این ماه">
        <div className="space-y-2 rounded-card bg-panel p-4">
          <Amount value={toDisplay(worth.change)} currency={cur} size="md" compact tone="auto" signed hidden={hidden} />
          <p className="text-caption text-fg-subtle">
            <Amount value={toDisplay(worth.saving)} currency={cur} size="xs" compact signed hidden={hidden} /> از پس‌انداز و{' '}
            <Amount value={toDisplay(worth.marketAndOther)} currency={cur} size="xs" compact signed hidden={hidden} /> از تغییر قیمت و سایر
          </p>
        </div>
      </Section>
    ),

    upcoming:
      soon.length > 0 ? (
        <Section title="۷ روز آینده" action={<Button size="sm" variant="link" render={<Link href="/deadlines" />} nativeButton={false}>برنامه</Button>}>
          <List>
            {soon.map((item) => (
              <ListRow
                key={item.key}
                chevron={false}
                leading={<Avatar tone={item.kind === 'check' ? 'peach' : item.kind === 'installment' ? 'sky' : 'lemon'} fallback={item.kind === 'check' ? <FileText /> : item.kind === 'installment' ? <Landmark /> : <Zap />} />}
                title={item.title}
                subtitle={
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone={item.daysLeft < 0 ? 'negative' : item.daysLeft <= 2 ? 'warning' : 'neutral'}>{daysLeftLabel(item.daysLeft)}</Badge>
                    {formatJalaaliHuman(parseJalaali(item.due)!)}
                  </span>
                }
                trailing={
                  <Button size="sm" variant="soft" loading={busyKey === item.key} aria-label={`پرداخت ${item.title}`} onClick={() => void pay(item, item.walletId ?? defaultWallet)}>
                    پرداخت
                  </Button>
                }
                trailingSubtitle={<Amount value={item.amount} currency={item.currency === 'USD' ? 'USD' : 'TOMAN'} size="xs" compact hidden={hidden} />}
              />
            ))}
          </List>
        </Section>
      ) : null,

    portfolio: (
      <Section title="ترکیب سبد">
        <div className="space-y-4 rounded-card bg-panel p-4">
          <SegmentedControl
            aria-label="نمای ترکیب"
            size="sm"
            value={allocView}
            onValueChange={setAllocView}
            options={[
              { value: 'groups', label: 'گروه‌ها' },
              { value: 'assets', label: 'دارایی‌ها' },
            ]}
          />
          <AllocationBar
            segments={(allocView === 'groups' ? stats.mainDistribution : stats.subDistribution).map((d) => ({ key: d.id, label: d.name, value: d.valueToman }))}
          />
          {runway != null && (
            <p className="text-caption text-fg-subtle">
              با نقدی فعلی حدود <span className="font-semibold text-fg">{runway.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} ماه</span> هزینه پوشش داده می‌شود.
              {idle > 0 && (
                <>
                  {' '}
                  <Amount value={toDisplay(idle)} currency={cur} size="xs" compact hidden={hidden} /> بیش از ۳ ماه هزینه، نقد مانده است.
                </>
              )}
            </p>
          )}
        </div>
        <GoalsDriftWidget />
      </Section>
    ),

    movers:
      movers.length > 0 ? (
        <Section title="بیشترین تغییر قیمت امروز" action={<Button size="sm" variant="link" render={<Link href="/prices" />} nativeButton={false}>قیمت‌ها</Button>}>
          <List>
            {movers.map((m) => (
              <ListRow
                key={m.asset.id}
                size="sm"
                render={<Link href={`/assets/${m.asset.id}`} />}
                leading={<Avatar size="sm" src={m.asset.icon_url} tone="lemon" fallback={<Coins />} />}
                title={m.asset.name}
                trailing={<Delta value={m.changePct} pill />}
                trailingSubtitle={<Amount value={m.priceToman} size="xs" compact />}
              />
            ))}
          </List>
        </Section>
      ) : null,

    cashflow: (
      <Section title="جریان نقدی امسال" action={<Button size="sm" variant="link" render={<Link href="/reports/cashflow" />} nativeButton={false}>گزارش</Button>}>
        <div className="rounded-card bg-panel p-4">
          <BarChart
            mode="signed"
            aria-label="درآمد منهای هزینه هر ماه امسال"
            data={yearFlow.map((p) => ({ key: String(p.month), label: p.label, value: p.income - p.expense }))}
            formatValue={(v) => (hidden ? '••••' : formatMoney(v, { compact: true, signed: true }).text)}
          />
        </div>
      </Section>
    ),

    quickadd:
      frequent.length > 0 ? (
        <Section title="ثبت سریع">
          <ChipGroup aria-label="ثبت‌های پرتکرار" value={[]} onValueChange={() => {}}>
            {frequent.map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId)?.name ?? '';
              const wallet = p.endpoint.kind === 'wallet' ? wallets.find((w) => w.id === p.endpoint.id)?.name ?? '' : '';
              const text = `${p.type === 'INCOME' ? 'درآمد ' : ''}${p.amount} ${cat} ${wallet}`.trim();
              return (
                <Chip key={p.key} value={p.key} onPressedChange={() => router.push(`/transactions/new?text=${encodeURIComponent(text)}`)}>
                  {cat} · {formatMoney(p.amount, { compact: true }).text}
                </Chip>
              );
            })}
          </ChipGroup>
        </Section>
      ) : null,
  };

  return (
    <div className="space-y-6 px-(--ds-gutter) pt-1 pb-8">
      {dataFetchError && (
        <Banner tone="negative" title="خطا در دریافت اطلاعات از سرور" action={<Button size="sm" variant="link" onClick={() => void refresh()}>تلاش دوباره</Button>} />
      )}

      {layout.order
        .filter((k) => !layout.hidden.includes(k))
        .map((k) => (blocks[k] ? <div key={k}>{blocks[k]}</div> : null))}

      <div className="flex justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          startIcon={<RefreshCw />}
          loading={refreshing}
          onClick={async () => {
            setRefreshing(true);
            await refreshAll();
            setRefreshing(false);
            toast.success('قیمت‌ها به‌روز شد');
          }}
        >
          به‌روزرسانی قیمت‌ها
        </Button>
        <Button variant="ghost" size="sm" startIcon={<Settings />} onClick={() => setEditOpen(true)}>
          ویرایش خانه
        </Button>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen} title="ویرایش خانه" description="ترتیب و نمایش بخش‌ها. چیزی حذف نمی‌شود؛ فقط پنهان.">
        <ul className="divide-y divide-line">
          {layout.order.map((k, i) => {
            const meta = BLOCKS.find((b) => b.key === k)!;
            const visible = !layout.hidden.includes(k);
            return (
              <li key={k} className="flex items-center gap-2 py-2">
                <Switch
                  className="flex-1"
                  label={meta.label}
                  checked={visible}
                  onCheckedChange={(on) =>
                    save({ ...layout, hidden: on ? layout.hidden.filter((h) => h !== k) : [...layout.hidden, k] })
                  }
                />
                <IconButton size="sm" aria-label={`بالا بردن ${meta.label}`} icon={<ChevronDown className="rotate-180" />} disabled={i === 0} onClick={() => save(moveBlock(layout, k, -1))} />
                <IconButton size="sm" aria-label={`پایین بردن ${meta.label}`} icon={<ChevronDown />} disabled={i === layout.order.length - 1} onClick={() => save(moveBlock(layout, k, 1))} />
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

function MiniStat({ icon, tint, label, value }: { icon: ReactNode; tint: 'mint' | 'rose'; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-sunken p-3">
      <Avatar size="sm" tone={tint} fallback={icon} />
      <div className="min-w-0">
        <Text variant="micro" tone="subtle" render={<p />}>
          {label}
        </Text>
        {value}
      </div>
    </div>
  );
}
