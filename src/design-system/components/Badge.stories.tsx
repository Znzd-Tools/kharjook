import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Clock } from '../icons';
import { Badge, CounterBadge } from './Badge';

const meta = {
  title: 'Data Display/Badge',
  component: Badge,
  args: { children: 'سررسید نزدیک', tone: 'warning' },
  argTypes: { tone: { control: 'select', options: ['neutral', 'accent', 'positive', 'negative', 'warning', 'info', 'solid'] } },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>پیش‌نویس</Badge>
      <Badge tone="accent">دوره‌ای</Badge>
      <Badge tone="positive" dot>پرداخت شد</Badge>
      <Badge tone="negative" dot>معوق</Badge>
      <Badge tone="warning" icon={<Clock />}>۳ روز مانده</Badge>
      <Badge tone="info">جدید</Badge>
      <Badge tone="solid">۱۰٪</Badge>
      <Badge size="md" tone="positive">بزرگ</Badge>
    </div>
  ),
};

export const Counter: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <CounterBadge count={3} />
      <CounterBadge count={42} />
      <CounterBadge count={240} />
      <span className="text-caption text-fg-subtle">(0 renders nothing)</span>
    </div>
  ),
};
