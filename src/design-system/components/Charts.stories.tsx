import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AllocationBar, BarChart, Sparkline } from './Charts';
import { Amount } from './Amount';
import { formatMoney } from '../lib/format';

const meta = {
  title: 'Charts',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Small, honest charts. One axis, no dual scales, categorical colors in fixed order (chart-1..8), text in text tokens. Hover or focus a mark to read its value.' } } },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Sparklines: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <Sparkline data={[4, 5, 4.6, 6, 5.8, 6.4, 7.1]} aria-label="رو به بالا" />
      <Sparkline data={[7, 6.5, 6.8, 5.2, 5.4, 4.6]} aria-label="رو به پایین" />
      <Sparkline data={[3, 3.4, 3.1, 3.6, 3.3]} tone="accent" area={false} aria-label="بدون ناحیه" />
      <Sparkline data={[2, 3, 2.5, 4, 3.8, 5]} tone="muted" width={160} height={40} aria-label="بزرگ" />
    </div>
  ),
};

export const Allocation: Story = {
  name: 'AllocationBar',
  render: () => (
    <div className="space-y-6 rounded-card bg-panel p-4">
      <AllocationBar
        segments={[
          { key: 'gold', label: 'طلا', value: 182 },
          { key: 'usd', label: 'دلار', value: 96 },
          { key: 'stock', label: 'سهام', value: 64 },
          { key: 'crypto', label: 'کریپتو', value: 28 },
          { key: 'cash', label: 'نقد', value: 22 },
          { key: 'car', label: 'خودرو', value: 9 },
          { key: 'other', label: 'سکه', value: 6 },
        ]}
      />
      <AllocationBar
        legend
        maxSegments={2}
        segments={[
          { key: 'assets', label: 'دارایی', value: 402_000_000 },
          { key: 'cash', label: 'نقدی', value: 61_500_000 },
        ]}
        formatValue={(v) => <Amount value={v} size="xs" compact />}
      />
    </div>
  ),
};

const MONTHS = ['اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر'];

export const Bars: Story = {
  name: 'BarChart',
  render: () => (
    <div className="space-y-6">
      <div className="rounded-card bg-panel p-4">
        <BarChart
          aria-label="هزینه ماهانه"
          data={MONTHS.map((m, i) => ({ key: m, label: m, value: [14, 18, 16, 22, 19, 12][i]! * 1_000_000 }))}
          formatValue={(v) => formatMoney(v, { compact: true }).text}
        />
      </div>
      <div className="rounded-card bg-panel p-4">
        <BarChart
          mode="signed"
          aria-label="جریان نقدی خالص"
          data={MONTHS.map((m, i) => ({ key: m, label: m, value: [6, -2, 4, -5, 3, 9][i]! * 1_000_000 }))}
          formatValue={(v) => formatMoney(v, { compact: true, signed: true }).text}
        />
      </div>
    </div>
  ),
};
