import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProgressBar, ProgressRing } from './Progress';

const meta = {
  title: 'Data Display/Progress',
  component: ProgressBar,
  args: { value: 62, max: 100, label: 'خوراک', valueLabel: '۶۲٪' },
  argTypes: { tone: { control: 'inline-radio', options: ['accent', 'auto', 'positive', 'negative', 'warning'] } },
  parameters: { docs: { description: { component: 'Budgets, goals and loan payoff. `tone="auto"` turns warning at 80% and negative above 100%. `marker` shows the expected point (e.g. where spend should be by today).' } } },
} satisfies Meta<typeof ProgressBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BudgetCaps: Story = {
  render: () => (
    <div className="space-y-5 rounded-card bg-panel p-4">
      <ProgressBar tone="auto" value={4.1} max={8} label="خوراک" valueLabel="۴٫۱ از ۸ میلیون" marker={5.2} />
      <ProgressBar tone="auto" value={2.7} max={3} label="حمل‌ونقل" valueLabel="۲٫۷ از ۳ میلیون" marker={1.9} />
      <ProgressBar tone="auto" value={3.6} max={3} label="تفریح" valueLabel="۳٫۶ از ۳ میلیون" />
      <ProgressBar tone="positive" size="md" value={70} label="بازپرداخت وام" valueLabel="۷ از ۱۰ قسط" />
    </div>
  ),
};

export const Ring: Story = {
  name: 'ProgressRing',
  render: () => (
    <div className="flex items-center gap-4">
      <ProgressRing value={35} aria-label="هدف طلا">۳۵٪</ProgressRing>
      <ProgressRing value={85} tone="auto" aria-label="بودجه">۸۵٪</ProgressRing>
      <ProgressRing value={100} tone="positive" size={72} strokeWidth={6} aria-label="کامل">✓</ProgressRing>
    </div>
  ),
};
