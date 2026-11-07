import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Text } from './Text';

const meta = {
  title: 'Data Display/Text',
  component: Text,
  args: { children: 'ارزش کل سبد', variant: 'body', tone: 'default' },
  argTypes: {
    variant: { control: 'select', options: ['display', 'headline', 'title', 'body', 'callout', 'caption', 'micro'] },
    tone: { control: 'select', options: ['default', 'muted', 'subtle', 'accent', 'positive', 'negative', 'warning'] },
    weight: { control: 'select', options: [undefined, 'regular', 'medium', 'semibold', 'bold'] },
  },
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Scale: Story = {
  render: () => (
    <div className="space-y-2">
      {(['display', 'headline', 'title', 'body', 'callout', 'caption', 'micro'] as const).map((v) => (
        <Text key={v} variant={v}>{v} — خرجوک، دفتر پول تو</Text>
      ))}
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="space-y-1">
      {(['default', 'muted', 'subtle', 'accent', 'positive', 'negative', 'warning'] as const).map((t) => (
        <Text key={t} tone={t}>{t} — متن نمونه</Text>
      ))}
    </div>
  ),
};

export const Truncate: Story = {
  args: { truncate: true, children: 'این یک متن خیلی طولانی است که باید در یک خط کوتاه شود تا چیدمان لیست به هم نریزد' },
  render: (args) => <div className="w-56"><Text {...args} /></div>,
};
