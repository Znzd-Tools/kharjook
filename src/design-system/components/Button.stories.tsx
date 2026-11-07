import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ArrowLeft, Download, MoreHorizontal, Pencil, Plus, Trash2, X } from '../icons';
import { fn } from 'storybook/test';
import { Button } from './Button';
import { IconButton } from './IconButton';

const meta = {
  title: 'Actions/Button',
  component: Button,
  args: { children: 'ثبت تراکنش', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'soft', 'ghost', 'danger', 'link'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'One primary button per screen. Use `secondary` next to it, `ghost`/`link` for low-emphasis actions, `danger` only for destructive actions with confirmation. Render a Next link with `render={<Link href="/x" />} nativeButton={false}`.',
      },
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <Button {...args} variant="primary">ذخیره</Button>
      <Button {...args} variant="secondary">انصراف</Button>
      <Button {...args} variant="soft">افزودن هدف</Button>
      <Button {...args} variant="ghost">بعداً</Button>
      <Button {...args} variant="danger">حذف</Button>
      <Button {...args} variant="link">مشاهده همه</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">کوچک</Button>
      <Button {...args} size="md">متوسط</Button>
      <Button {...args} size="lg">بزرگ</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <Button {...args} startIcon={<Plus />}>تراکنش جدید</Button>
      <Button {...args} variant="secondary" endIcon={<ArrowLeft />}>ادامه</Button>
      <Button {...args} variant="soft" startIcon={<Download />}>خروجی CSV</Button>
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <Button {...args} loading>در حال ثبت</Button>
      <Button {...args} disabled>غیرفعال</Button>
      <Button {...args} variant="secondary" disabled>غیرفعال</Button>
    </div>
  ),
};

export const FullWidth: Story = {
  args: { fullWidth: true, size: 'lg', children: 'ثبت هزینه' },
};

export const IconButtons: Story = {
  name: 'IconButton',
  render: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <IconButton aria-label="ویرایش" icon={<Pencil />} />
        <IconButton aria-label="بیشتر" icon={<MoreHorizontal />} variant="secondary" />
        <IconButton aria-label="افزودن" icon={<Plus />} variant="primary" shape="circle" />
        <IconButton aria-label="افزودن" icon={<Plus />} variant="soft" />
        <IconButton aria-label="حذف" icon={<Trash2 />} variant="danger" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <IconButton aria-label="بستن" icon={<X />} size="sm" variant="secondary" shape="circle" />
        <IconButton aria-label="بستن" icon={<X />} size="md" variant="secondary" shape="circle" />
        <IconButton aria-label="بستن" icon={<X />} size="lg" variant="secondary" shape="circle" />
      </div>
      <p className="text-caption text-fg-subtle">`aria-label` is required. Small sizes still have a 44px touch target.</p>
    </div>
  ),
};
