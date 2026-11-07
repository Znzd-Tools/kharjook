import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpLeft, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Chip, ChipGroup, InputChip } from './Chip';

const meta = {
  title: 'Actions/Chip',
  component: Chip,
  args: { children: 'هزینه' },
  parameters: { docs: { description: { component: 'Filters and quick choices. Use `ChipGroup` for single or multi select. Rows scroll horizontally.' } } },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: function Render() {
    const [v, setV] = useState(['month']);
    return (
      <ChipGroup aria-label="بازه" value={v} onValueChange={(n) => n.length && setV(n)}>
        <Chip value="week">این هفته</Chip>
        <Chip value="month">این ماه</Chip>
        <Chip value="3m">۳ ماه</Chip>
        <Chip value="year">امسال</Chip>
        <Chip value="all">همه</Chip>
      </ChipGroup>
    );
  },
};

export const Multiple: Story = {
  render: function Render() {
    const [v, setV] = useState(['expense']);
    return (
      <ChipGroup aria-label="نوع" multiple value={v} onValueChange={setV}>
        <Chip value="expense" icon={<ArrowUpLeft />} count={128}>هزینه</Chip>
        <Chip value="income" icon={<ArrowDownLeft />} count={12}>درآمد</Chip>
        <Chip value="transfer" icon={<ArrowLeftRight />} count={9}>انتقال</Chip>
        <Chip value="trade" count={31}>خرید و فروش</Chip>
      </ChipGroup>
    );
  },
};

export const ActiveFilters: Story = {
  name: 'InputChip (active filters)',
  render: function Render() {
    const [items, setItems] = useState(['کیف ملت', 'خوراک', 'مهر ۱۴۰۵']);
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <InputChip key={i} icon={i === 'کیف ملت' ? <Wallet /> : undefined} onRemove={() => setItems((s) => s.filter((x) => x !== i))}>
            {i}
          </InputChip>
        ))}
      </div>
    );
  },
};
