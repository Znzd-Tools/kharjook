import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bus, Coffee, Gift, HeartPulse, Home, LayoutGrid, Shirt, ShoppingCart, Utensils, Zap } from '../icons';
import { useState } from 'react';
import { ChoiceGrid } from './ChoiceGrid';

const CATS = [
  { value: 'food', label: 'خوراک', icon: <Utensils />, color: '#eb6834' },
  { value: 'grocery', label: 'سوپرمارکت', icon: <ShoppingCart />, color: '#1baf7a' },
  { value: 'transport', label: 'حمل‌ونقل', icon: <Bus />, color: '#2a78d6' },
  { value: 'cafe', label: 'کافه', icon: <Coffee />, color: '#eda100' },
  { value: 'home', label: 'خانه', icon: <Home /> },
  { value: 'bills', label: 'قبوض', icon: <Zap /> },
  { value: 'health', label: 'سلامت', icon: <HeartPulse />, color: '#e34948' },
  { value: 'clothes', label: 'پوشاک', icon: <Shirt /> },
  { value: 'gift', label: 'هدیه', icon: <Gift />, color: '#e87ba4' },
];

const meta = {
  title: 'Forms/ChoiceGrid',
  component: ChoiceGrid,
  parameters: { docs: { description: { component: 'One-tap choice with icon tiles. Show the most used 7–11 options, then a "همه" tile that opens a PickerSheet.' } } },
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
