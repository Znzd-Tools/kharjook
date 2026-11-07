import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Lightbulb } from '../icons';
import { Card } from './Card';
import { Divider } from './Divider';
import { Section } from './Section';
import { Button } from './Button';

const meta = {
  title: 'Data Display/Card',
  component: Card,
  args: { children: 'محتوای کارت' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['filled', 'outline', 'accent', 'elevated', 'sunken'] },
    padding: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
  },
  parameters: { docs: { description: { component: 'Use a card only when content needs a container. For collections use `List`. For titled groups use `Section`.' } } },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3">
      {(['filled', 'outline', 'accent', 'elevated', 'sunken'] as const).map((v) => (
        <Card key={v} variant={v}><p className="text-callout">{v}</p></Card>
      ))}
      <Card interactive render={<button type="button" />}><p className="text-callout">interactive</p></Card>
    </div>
  ),
};

export const SectionStory: Story = {
  name: 'Section',
  render: () => (
    <div className="space-y-6">
      <Section title="سررسیدهای این هفته" description="۳ مورد" action={<Button variant="link" size="sm">همه</Button>}>
        <Card><p className="text-callout text-fg-muted">محتوای بخش</p></Card>
      </Section>
      <Section title="پیشنهاد">
        <Card variant="accent" className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-accent-ink" />
          <div className="space-y-1">
            <p className="text-callout font-semibold text-fg">طلا از هدف ۵٪ عقب است</p>
            <p className="text-caption text-fg-muted">برای رسیدن به هدف، حدود ۸ میلیون تومان طلا بخر.</p>
          </div>
        </Card>
      </Section>
    </div>
  ),
};

export const DividerStory: Story = {
  name: 'Divider',
  render: () => (
    <div className="space-y-4">
      <Divider />
      <Divider label="یا" />
      <div className="flex h-8 items-center gap-3 text-caption"><span>چپ</span><Divider orientation="vertical" /><span>راست</span></div>
    </div>
  ),
};
