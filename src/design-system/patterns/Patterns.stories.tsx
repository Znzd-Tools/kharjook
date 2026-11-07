import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ArrowDownLeft, ArrowLeftRight, Lightbulb, ArrowUpLeft, Bus, CalendarDays, Check, Coffee, Coins, Eye, EyeOff, FileText, Home,
  Landmark, LayoutGrid, PieChart, Receipt, RefreshCw, ShoppingCart, Utensils, Wallet, Zap, X,
} from '../icons';
import { useState } from 'react';
import {
  ActionSheet, AllocationBar, Amount, Card, Avatar, Badge, Banner, BarChart, Button, Chip, ChipGroup, ChoiceGrid, DateField,
  Delta, Disclosure, Fab, Field, IconButton, Input, Keypad, List, ListRow, PickerField, ProgressBar, Section, SegmentedControl,
  Sheet, TabBar, TopBar, toast, AmountField, formatMoney,
} from '../index';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';

const meta = {
  title: 'Patterns',
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Full screens built only from design-system parts. They show the target UX: fewer cards, fewer buttons, fewer taps.' } } },
} satisfies Meta;
export default meta;
type Story = StoryObj;

function AppFrame({ children, tab = 'home' }: { children: React.ReactNode; tab?: string }) {
  const [quick, setQuick] = useState(false);
  return (
    <div className="relative mx-auto flex h-dvh max-w-(--ds-max-width) flex-col bg-canvas">
      <main className="flex-1 overflow-y-auto pb-6 scrollbar-hide">{children}</main>
      <TabBar
        activeKey={tab}
        items={[
          { key: 'home', label: 'خانه', icon: <Home /> },
          { key: 'ledger', label: 'تراکنش‌ها', icon: <Receipt /> },
          { key: 'portfolio', label: 'سبد', icon: <PieChart /> },
          { key: 'plan', label: 'برنامه', icon: <CalendarDays />, badge: 2 },
        ]}
        center={<Fab aria-label="ثبت هزینه" onPress={() => toast.show('صفحه ثبت هزینه')} onLongPress={() => setQuick(true)} />}
      />
      <ActionSheet
        open={quick}
        onOpenChange={setQuick}
        layout="grid"
        title="ثبت سریع"
        actions={[
          { key: 'e', label: 'هزینه', icon: <ArrowUpLeft />, onSelect: () => {} },
          { key: 'i', label: 'درآمد', icon: <ArrowDownLeft />, onSelect: () => {} },
          { key: 't', label: 'انتقال', icon: <ArrowLeftRight />, onSelect: () => {} },
          { key: 'b', label: 'خرید دارایی', icon: <Coins />, onSelect: () => {} },
          { key: 's', label: 'فروش دارایی', icon: <Landmark />, onSelect: () => {} },
          { key: 'c', label: 'تبدیل', icon: <RefreshCw />, onSelect: () => {} },
        ]}
      />
    </div>
  );
}

function HomeScreen() {
  const [hidden, setHidden] = useState(false);
  const [currency, setCurrency] = useState<'TOMAN' | 'USD'>('TOMAN');
  const net = currency === 'TOMAN' ? 463_500_000 : 5_150;
  return (
    <AppFrame>
      <TopBar
        leading={<Avatar name="علی" size="sm" tone="lilac" />}
        actions={<IconButton aria-label={hidden ? 'نمایش مبالغ' : 'پنهان کردن مبالغ'} icon={hidden ? <EyeOff /> : <Eye />} onClick={() => setHidden((h) => !h)} />}
      />
      <div className="space-y-6 px-(--ds-gutter)">
        <Card
          variant="hero"
          padding="lg"
          interactive
          render={<button type="button" />}
          onClick={() => setCurrency((c) => (c === 'TOMAN' ? 'USD' : 'TOMAN'))}
          aria-label="تغییر واحد"
          className="block w-full space-y-4 hover:bg-(image:--gradient-hero)"
        >
          <div className="flex items-center justify-between">
            <p className="text-caption text-fg-on-hero-muted">ارزش کل دارایی</p>
            <span className="rounded-full bg-white/25 px-2.5 py-1 text-micro font-semibold backdrop-blur-sm">{currency === 'TOMAN' ? 'تومان' : 'دلار'}</span>
          </div>
          <Amount value={net} currency={currency} size="hero" tone="inherit" hidden={hidden} />
          <div className="flex items-center gap-2 text-caption text-fg-on-hero-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 font-semibold text-fg-on-hero backdrop-blur-sm">↑ ۱٫۸٪</span>
            <span>امروز · ۸٫۲ میلیون بیشتر</span>
          </div>
        </Card>

        <Section title="این ماه" action={<Button size="sm" variant="link">گزارش</Button>}>
          <div className="space-y-4 rounded-card bg-panel p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-card bg-sunken p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint-mint-soft text-tint-mint-ink [&_svg]:size-4.5"><ArrowDownLeft /></span>
                <div><p className="text-micro text-fg-subtle">درآمد</p><Amount value={35_000_000} compact size="sm" hidden={hidden} /></div>
              </div>
              <div className="flex items-center gap-3 rounded-card bg-sunken p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint-rose-soft text-tint-rose-ink [&_svg]:size-4.5"><ArrowUpLeft /></span>
                <div><p className="text-micro text-fg-subtle">هزینه</p><Amount value={18_400_000} compact size="sm" hidden={hidden} /></div>
              </div>
            </div>
            <ProgressBar tone="auto" value={18.4} max={24} label="از بودجه ماه" valueLabel="۷۷٪" marker={17} />
          </div>
        </Section>

        <Section title="۷ روز آینده" description="۳ مورد" action={<Button size="sm" variant="link">برنامه</Button>}>
          <List>
            <ListRow leading={<Avatar fallback={<FileText />} tone="peach" shape="circle" />} title="چک به آقای رضایی" subtitle={<Badge tone="warning">فردا</Badge>} trailing={<Amount value={12_000_000} size="sm" hidden={hidden} />} />
            <ListRow leading={<Avatar fallback={<Landmark />} tone="sky" shape="circle" />} title="قسط وام مسکن" subtitle="۱۸ مهر" trailing={<Button size="sm" variant="soft" startIcon={<Check />} onClick={() => toast.success('پرداخت ثبت شد')}>پرداخت</Button>} />
            <ListRow leading={<Avatar fallback={<Zap />} tone="lemon" shape="circle" />} title="اشتراک اینترنت" subtitle="۲۰ مهر · خودکار" trailing={<Amount value={450_000} size="sm" hidden={hidden} />} />
          </List>
        </Section>

        <Banner tone="accent" icon={<Lightbulb />} title="پیشنهاد" action={<Button size="sm" variant="link">جزئیات</Button>}>طلا ۵٪ زیر هدف است. حدود ۸ میلیون تومان طلا بخر.</Banner>
      </div>
    </AppFrame>
  );
}

export const HomeTab: Story = { name: 'Home tab', render: () => <HomeScreen /> };

const CATS = [
  { value: 'food', label: 'خوراک', icon: <Utensils />, tint: 'peach' as const },
  { value: 'grocery', label: 'سوپرمارکت', icon: <ShoppingCart />, tint: 'mint' as const },
  { value: 'transport', label: 'حمل‌ونقل', icon: <Bus />, tint: 'sky' as const },
  { value: 'cafe', label: 'کافه', icon: <Coffee />, tint: 'lemon' as const },
  { value: 'home', label: 'خانه', icon: <Home />, tint: 'lilac' as const },
  { value: 'bills', label: 'قبوض', icon: <Zap />, tint: 'rose' as const },
  { value: 'gift', label: 'هدیه', icon: <Receipt />, tint: 'lilac' as const },
];
const WALLETS = [
  { value: 'mellat', label: 'بانک ملت', leading: <Avatar size="sm" fallback={<Landmark />} tone="sky" /> },
  { value: 'cash', label: 'نقد', leading: <Avatar size="sm" fallback={<Wallet />} tone="mint" /> },
];

function AddExpenseScreen() {
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string | null>('food');
  const [wallet, setWallet] = useState<string | null>('mellat');
  const [date, setDate] = useState(formatJalaali(todayJalaali()));
  const [kind, setKind] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [details, setDetails] = useState(false);
  return (
    <div className="mx-auto flex h-dvh max-w-(--ds-max-width) flex-col bg-canvas">
      <TopBar
        leading={<IconButton aria-label="بستن" icon={<X />} />}
        actions={<Button size="sm" variant="ghost" onClick={() => setDetails(true)}>جزئیات</Button>}
      />
      <div className="px-(--ds-gutter)">
        <SegmentedControl
          aria-label="نوع"
          value={kind}
          onValueChange={setKind}
          options={[
            { value: 'expense', label: 'هزینه' },
            { value: 'income', label: 'درآمد' },
            { value: 'transfer', label: 'انتقال' },
          ]}
        />
      </div>
      <AmountField size="hero" value={amount} onValueChange={setAmount} readOnly />
      <div className="flex-1 space-y-4 overflow-y-auto px-(--ds-gutter)">
        <ChoiceGrid aria-label="دسته" choices={CATS} value={cat} onValueChange={setCat} trailingTile={
          <button type="button" className="ds-focus flex flex-col items-center gap-1.5 rounded-card px-1 py-2.5 hover:bg-hover">
            <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-line-strong text-fg-subtle"><LayoutGrid className="size-5" /></span>
            <span className="text-micro text-fg-subtle">همه</span>
          </button>
        } />
        <ChipGroup aria-label="کیف پول" value={wallet ? [wallet] : []} onValueChange={(v) => v[0] && setWallet(v[0])}>
          {WALLETS.map((w) => <Chip key={w.value} value={w.value} icon={w.value === 'cash' ? <Wallet /> : <Landmark />}>{w.label}</Chip>)}
        </ChipGroup>
      </div>
      <div className="space-y-2 border-t border-line bg-panel px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <Keypad value={amount} onValueChange={setAmount} />
        <Button fullWidth size="lg" disabled={!amount || !cat} onClick={() => toast.success(`${formatMoney(Number(amount)).text} ثبت شد`, { action: { label: 'برگردان', onClick: () => {} } })}>
          ثبت هزینه
        </Button>
      </div>
      <Sheet open={details} onOpenChange={setDetails} title="جزئیات" footer={<Button fullWidth onClick={() => setDetails(false)}>تأیید</Button>}>
        <div className="space-y-4">
          <Field label="تاریخ"><DateField value={date} onValueChange={setDate} /></Field>
          <Field label="کیف پول"><PickerField title="کیف پول" options={WALLETS} value={wallet} onValueChange={setWallet} /></Field>
          <Field label="یادداشت" labelEnd="اختیاری"><Input placeholder="مثلاً ناهار با تیم" /></Field>
          <Disclosure title="بیشتر" summary="کارمزد، تکرار">
            <Field label="کارمزد"><Input inputMode="decimal" endAdornment="تومان" /></Field>
          </Disclosure>
        </div>
      </Sheet>
    </div>
  );
}

export const AddExpense: Story = {
  name: 'Add expense (amount-first)',
  parameters: { docs: { description: { story: 'Type amount → tap category → save. Wallet and date have smart defaults. 3 taps for the common case.' } } },
  render: () => <AddExpenseScreen />,
};

function PortfolioScreen() {
  const [view, setView] = useState<'assets' | 'wallets'>('assets');
  return (
    <AppFrame tab="portfolio">
      <TopBar variant="large" title="سبد" subtitle="ارزش کل ۴۶۳٫۵ میلیون تومان" />
      <div className="space-y-6 px-(--ds-gutter)">
        <SegmentedControl aria-label="نما" value={view} onValueChange={setView} options={[{ value: 'assets', label: 'دارایی‌ها' }, { value: 'wallets', label: 'کیف پول‌ها' }]} />
        {view === 'assets' ? (
          <>
            <div className="rounded-card bg-panel p-4">
              <AllocationBar segments={[{ key: 'g', label: 'طلا', value: 182 }, { key: 'u', label: 'دلار', value: 96 }, { key: 's', label: 'سهام', value: 64 }, { key: 'c', label: 'کریپتو', value: 28 }, { key: 'x', label: 'سایر', value: 15 }]} />
            </div>
            <List>
              <ListRow onClick={() => {}} leading={<Avatar fallback={<Coins />} tone="lemon" shape="circle" />} title="طلای ۱۸" subtitle="۴۲٫۵ گرم" trailing={<Amount value={182_000_000} size="sm" compact />} trailingSubtitle={<Delta value={2.1} />} />
              <ListRow onClick={() => {}} leading={<Avatar fallback={<Coins />} tone="mint" shape="circle" />} title="دلار" subtitle="۱٬۰۵۰ دلار" trailing={<Amount value={96_000_000} size="sm" compact />} trailingSubtitle={<Delta value={-0.4} />} />
              <ListRow onClick={() => {}} leading={<Avatar fallback={<Coins />} tone="sky" shape="circle" />} title="صندوق سهامی" subtitle="۱۲٬۰۰۰ واحد" trailing={<Amount value={64_000_000} size="sm" compact />} trailingSubtitle={<Delta value={5.6} />} />
            </List>
          </>
        ) : (
          <List>
            <ListRow onClick={() => {}} leading={<Avatar fallback={<Landmark />} tone="sky" />} title="بانک ملت" subtitle="جاری" trailing={<Amount value={48_200_000} size="sm" />} />
            <ListRow onClick={() => {}} leading={<Avatar fallback={<Wallet />} tone="mint" />} title="نقد" trailing={<Amount value={1_350_000} size="sm" />} />
          </List>
        )}
        <Section title="روند ۶ ماه">
          <div className="rounded-card bg-panel p-4">
            <BarChart aria-label="ارزش سبد" data={['اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر'].map((m, i) => ({ key: m, label: m, value: [380, 392, 401, 420, 447, 463][i]! * 1e6 }))} formatValue={(v) => formatMoney(v, { compact: true }).text} />
          </div>
        </Section>
      </div>
    </AppFrame>
  );
}

export const Portfolio: Story = { name: 'Portfolio tab', render: () => <PortfolioScreen /> };
