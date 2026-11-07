import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Coffee, Copy, Landmark, Pencil, ShoppingCart, Trash2, Wallet } from '../icons';
import { fn } from 'storybook/test';
import { Amount } from './Amount';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { List, ListHeader, ListRow } from './List';
import { SwipeRow } from './SwipeRow';
import { toast } from './Toast';

const meta = {
  title: 'Data Display/List',
  component: ListRow,
  args: { title: 'کیف پول ملت', subtitle: 'حساب جاری', onClick: fn() },
  parameters: { docs: { description: { component: 'The default way to show collections. Rows: leading · title/subtitle · trailing. Prefer lists over stacks of cards.' } } },
} satisfies Meta<typeof ListRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <List>
      <ListRow {...args} leading={<Avatar fallback={<Wallet />} tone="lilac" />} trailing={<Amount value={12_450_000} size="sm" />} />
    </List>
  ),
};

export const Wallets: Story = {
  render: () => (
    <List aria-label="کیف پول‌ها">
      <ListRow onClick={fn()} leading={<Avatar fallback={<Landmark />} tone="sky" />} title="بانک ملت" subtitle="جاری · ۶۱۰۴…۱۲۳۴" trailing={<Amount value={48_200_000} size="sm" />} />
      <ListRow onClick={fn()} leading={<Avatar fallback={<Wallet />} tone="mint" />} title="نقد" subtitle="کیف جیبی" trailing={<Amount value={1_350_000} size="sm" />} />
      <ListRow onClick={fn()} leading={<Avatar fallback={<Landmark />} tone="rose" />} title="رسالت" subtitle="قرض‌الحسنه" trailing={<Amount value={-2_000_000} size="sm" />} trailingSubtitle="بدهکار" />
    </List>
  ),
};

export const Ledger: Story = {
  name: 'Ledger (grouped by date)',
  render: () => (
    <div className="space-y-2">
      <ListHeader trailing={<Amount value={-640_000} size="xs" tone="muted" />}>امروز</ListHeader>
      <List>
        <ListRow leading={<Avatar fallback={<Coffee />} tone="peach" />} title="کافه" subtitle="ملت · ۰۹:۴۰" trailing={<Amount value={-180_000} size="sm" tone="auto" />} onClick={fn()} chevron={false} />
        <ListRow leading={<Avatar fallback={<ShoppingCart />} tone="mint" />} title="خرید هفتگی" subtitle="نقد · ۱۸:۲۰" trailing={<Amount value={-460_000} size="sm" tone="auto" />} onClick={fn()} chevron={false} />
      </List>
      <ListHeader trailing={<Amount value={35_000_000} size="xs" tone="muted" signed />}>دیروز</ListHeader>
      <List>
        <ListRow leading={<Avatar fallback={<Landmark />} tone="mint" />} title="حقوق مهر" subtitle={<span className="inline-flex items-center gap-1">ملت <Badge tone="accent">دوره‌ای</Badge></span>} trailing={<Amount value={35_000_000} size="sm" tone="auto" signed />} onClick={fn()} chevron={false} />
      </List>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <List>
      <ListRow title="اندازه متوسط (پیش‌فرض)" subtitle="۶۴ پیکسل" />
      <ListRow size="sm" title="اندازه کوچک" trailing="۴۸px" />
      <ListRow size="sm" title="غیرفعال" disabled onClick={fn()} />
    </List>
  ),
};

export const PlainList: Story = {
  render: () => (
    <List variant="plain">
      <ListRow title="بدون کارت" subtitle="ردیف‌ها مستقیم روی پس‌زمینه" />
      <ListRow title="ردیف دوم" subtitle="با خط جداکننده" />
    </List>
  ),
};

export const Swipe: Story = {
  name: 'SwipeRow',
  parameters: { docs: { description: { story: 'Drag a row to the right to reveal actions (RTL trailing edge). The same actions must also exist in a long-press ActionSheet for users who do not swipe.' } } },
  render: () => (
    <List>
      {['کافه', 'تاکسی', 'خرید هفتگی'].map((t, i) => (
        <li key={t}>
          <SwipeRow
            actions={[
              { key: 'edit', label: 'ویرایش', icon: <Pencil />, tone: 'neutral', onAction: () => toast.show('ویرایش') },
              { key: 'copy', label: 'تکرار', icon: <Copy />, tone: 'accent', onAction: () => toast.success('تکرار شد') },
              { key: 'del', label: 'حذف', icon: <Trash2 />, tone: 'negative', onAction: () => toast.error('حذف شد', { action: { label: 'برگردان', onClick: () => toast.success('برگشت') } }) },
            ]}
          >
            <ListRow asListItem={false} className={i > 0 ? 'border-t border-line' : ''} leading={<Avatar fallback={<Coffee />} />} title={t} subtitle="بکش به راست" trailing={<Amount value={-(i + 1) * 120_000} size="sm" tone="auto" />} />
          </SwipeRow>
        </li>
      ))}
    </List>
  ),
};
