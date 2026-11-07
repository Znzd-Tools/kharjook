import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Coins, Landmark, Wallet } from '../icons';
import { Avatar } from './Avatar';

const IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f5b301'/><circle cx='20' cy='20' r='11' fill='%23fff3' stroke='%23fff' stroke-width='2'/></svg>".replace(/%23/g, '#'));

const meta = {
  title: 'Data Display/Avatar',
  component: Avatar,
  args: { fallback: <Wallet />, tone: 'accent', size: 'md' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    tone: { control: 'select', options: ['neutral', 'accent', 'positive', 'negative', 'warning', 'info'] },
    shape: { control: 'inline-radio', options: ['rounded', 'circle'] },
  },
  parameters: { docs: { description: { component: 'Entity image for assets, wallets, people and categories. Shows an uploaded image, or an icon/initials fallback. Replaces `EntityIcon`.' } } },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Kinds: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar fallback={<Landmark />} tone="info" />
      <Avatar fallback={<Coins />} color="#eda100" />
      <Avatar name="علی زین‌الزاده" shape="circle" tone="neutral" />
      <Avatar src={IMG} name="تصویر" />
      <Avatar fallback={<Wallet />} tone="positive" shape="circle" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => <Avatar key={s} size={s} fallback={<Wallet />} tone="accent" />)}
    </div>
  ),
};
