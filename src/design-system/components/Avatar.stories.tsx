import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Coins, Landmark, Wallet } from '../icons';
import { Avatar } from './Avatar';

const IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f5b301'/><circle cx='20' cy='20' r='11' fill='%23fff3' stroke='%23fff' stroke-width='2'/></svg>".replace(/%23/g, '#'));

const meta = {
  title: 'Data Display/Avatar',
  component: Avatar,
  args: { fallback: <Wallet />, tone: 'lilac', size: 'md' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    tone: { control: 'select', options: ['neutral', 'rose', 'peach', 'lemon', 'mint', 'sky', 'lilac', 'accent', 'positive', 'negative', 'warning', 'info'] },
    shape: { control: 'inline-radio', options: ['rounded', 'circle'] },
  },
  parameters: { docs: { description: { component: 'Entity image for assets, wallets, people and categories. Shows an uploaded image, or an icon/initials fallback. Use a pastel `tone` (rose, peach, lemon, mint, sky, lilac) for entities; `color` only for user-picked colors. Replaces `EntityIcon`.' } } },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Kinds: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(['rose', 'peach', 'lemon', 'mint', 'sky', 'lilac'] as const).map((t) => (
        <Avatar key={t} fallback={<Wallet />} tone={t} />
      ))}
      <Avatar name="علی زین‌الزاده" />
      <Avatar src={IMG} name="تصویر" />
      <Avatar fallback={<Landmark />} shape="rounded" tone="sky" />
      <Avatar fallback={<Coins />} color="oklch(0.8 0.15 80)" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => <Avatar key={s} size={s} fallback={<Wallet />} tone="lilac" />)}
    </div>
  ),
};
