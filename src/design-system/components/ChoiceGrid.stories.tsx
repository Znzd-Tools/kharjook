import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bus, Coffee, Gift, HeartPulse, Home, LayoutGrid, Shirt, ShoppingCart, Utensils, Zap } from '../icons';
import { useState } from 'react';
import { ChoiceGrid } from './ChoiceGrid';

const CATS = [
  { value: 'food', label: 'خوراک', icon: <Utensils />, tint: 'peach' as const },
  { value: 'grocery', label: 'سوپرمارکت', icon: <ShoppingCart />, tint: 'mint' as const },
  { value: 'transport', label: 'حمل‌ونقل', icon: <Bus />, tint: 'sky' as const },
  { value: 'cafe', label: 'کافه', icon: <Coffee />, tint: 'lemon' as const },
  { value: 'home', label: 'خانه', icon: <Home />, tint: 'lilac' as const },
  { value: 'bills', label: 'قبوض', icon: <Zap />, tint: 'lemon' as const },
  { value: 'health', label: 'سلامت', icon: <HeartPulse />, tint: 'rose' as const },
  { value: 'clothes', label: 'پوشاک', icon: <Shirt />, tint: 'sky' as const },
  { value: 'gift', label: 'هدیه', icon: <Gift />, tint: 'rose' as const },
];

const meta = {
  title: 'Forms/ChoiceGrid',
  component: ChoiceGrid,
  parameters: { docs: { description: { component: 'One-tap choice with pastel icon tiles (`tint`). Show the most used 7–11 options, then a "همه" tile that opens a PickerSheet.' } } },
  args: { choices: CATS, value: 'food', onValueChange: () => {}, 'aria-label': 'دسته‌بندی' },
} satisfies Meta<typeof ChoiceGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Categories: Story = {
  render: function Render(args) {
    const [v, setV] = useState<string | null>('food');
    return (
      <ChoiceGrid
        {...args}
        value={v}
        onValueChange={setV}
        trailingTile={
          <button type="button" className="ds-focus flex flex-col items-center gap-1.5 rounded-card px-1 py-2.5 hover:bg-hover">
            <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-line-strong text-fg-subtle"><LayoutGrid className="size-5" /></span>
            <span className="text-micro text-fg-subtle">همه</span>
          </button>
        }
      />
    );
  },
};
