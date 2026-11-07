import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PieChart, TrendingUp, Wallet } from 'lucide-react';
import { Amount } from './Amount';
import { Delta } from './Delta';
import { StatTile } from './StatTile';
import { Sparkline } from './Charts';

const meta = {
  title: 'Data Display/Amount',
  component: Amount,
  args: { value: 12_450_000, currency: 'TOMAN', size: 'md', tone: 'default' },
  argTypes: {
    size: { control: 'inline-radio', options: ['hero', 'lg', 'md', 'sm', 'xs'] },
    tone: { control: 'inline-radio', options: ['default', 'auto', 'muted', 'positive', 'negative'] },
    currency: { control: 'inline-radio', options: ['TOMAN', 'USD'] },
  },
  parameters: { docs: { description: { component: 'The only way to show money. Persian digits, real minus (−), unit in smaller type, tabular figures. Use `tone="auto"` only for changes (income/expense, PnL), never for balances.' } } },
} satisfies Meta<typeof Amount>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-3">
      {(['hero', 'lg', 'md', 'sm', 'xs'] as const).map((s) => <Amount key={s} {...args} size={s} />)}
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <Amount value={-1_250_000} tone="auto" />
      <Amount value={35_000_000} tone="auto" signed />
      <Amount value={12_450_000} compact />
      <Amount value={2_400_000_000} compact size="lg" />
      <Amount value={1234.5} currency="USD" />
      <Amount value={12_450_000} hidden />
      <Amount value={12_450_000} hideUnit />
    </div>
  ),
};

export const DeltaStory: Story = {
  name: 'Delta',
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Delta value={12.4} />
      <Delta value={-3.2} />
      <Delta value={0} />
      <Delta value={8.1} pill />
      <Delta value={-1.7} pill />
      <Delta value={15} invert pill />
      <Delta value={4.2} size="md" />
    </div>
  ),
};

export const StatTiles: Story = {
  name: 'StatTile',
  render: () => (
    <div className="grid grid-cols-2 gap-3">
      <StatTile label="هزینه این ماه" icon={<Wallet />} value={<Amount value={18_400_000} size="md" compact />} meta={<Delta value={6.5} invert />} />
      <StatTile label="سود باز" icon={<TrendingUp />} value={<Amount value={4_200_000} size="md" compact tone="auto" signed />} meta="از ۹ دارایی" />
      <StatTile
        className="col-span-2"
        label="ارزش طلا"
        icon={<PieChart />}
        value={<Amount value={182_000_000} size="lg" compact />}
        meta={<Delta value={2.1} pill />}
        chart={<Sparkline data={[3, 4, 3.6, 5, 4.8, 5.6, 6.1, 5.9, 6.6]} width={320} height={40} aria-label="روند ۳۰ روز" />}
        onClick={() => {}}
      />
    </div>
  ),
};
