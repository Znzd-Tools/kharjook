import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpLeft, Copy, Coins, Landmark, MoreHorizontal, Pencil, RefreshCw, Trash2 } from '../icons';
import { useState } from 'react';
import { ActionSheet } from './ActionSheet';
import { Amount } from './Amount';
import { Button } from './Button';
import { ConfirmDialog, Dialog, useConfirm } from './Dialog';
import { Field } from './Field';
import { IconButton } from './IconButton';
import { List, ListRow } from './List';
import { Menu } from './Menu';
import { Sheet } from './Sheet';
import { Input } from './TextField';
import { AmountField } from './AmountField';
import { toast } from './Toast';
import { Tooltip } from './Tooltip';

const meta = { title: 'Overlays', tags: ['autodocs'] } satisfies Meta;
export default meta;
type Story = StoryObj;

export const SheetBasic: Story = {
  name: 'Sheet',
  parameters: { docs: { description: { story: 'Main overlay on mobile. Swipe down, tap the backdrop or press Esc to close. Prefer it over a centered dialog.' } } },
  render: () => (
    <Sheet trigger={<Button variant="secondary">باز کردن جزئیات</Button>} title="بانک ملت" description="حساب جاری">
      <List variant="plain">
        <ListRow size="sm" title="موجودی" trailing={<Amount value={48_200_000} size="sm" />} />
        <ListRow size="sm" title="شماره کارت" trailing={<span dir="ltr" className="tabular">6104 3378 •••• 1234</span>} />
        <ListRow size="sm" title="شبا" trailing={<span dir="ltr" className="tabular">IR12 •••• 9876</span>} />
      </List>
    </Sheet>
  ),
};

export const SheetForm: Story = {
  name: 'Sheet with form + footer',
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [v, setV] = useState('');
    return (
      <>
        <Button onClick={() => setOpen(true)}>ثبت نرخ دلار</Button>
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="نرخ دلار امروز"
          footer={
            <Button fullWidth size="lg" onClick={() => { setOpen(false); toast.success('نرخ ثبت شد'); }}>
              ذخیره
            </Button>
          }
        >
          <div className="space-y-4">
            <Field label="قیمت هر دلار"><AmountField value={v} onValueChange={setV} autoFocus /></Field>
            <Field label="منبع" labelEnd="اختیاری"><Input placeholder="بازار آزاد" /></Field>
          </div>
        </Sheet>
      </>
    );
  },
};

export const QuickActions: Story = {
  name: 'ActionSheet (grid)',
  parameters: { docs: { description: { story: 'Long-press on the FAB opens this. Tap on FAB goes straight to "هزینه".' } } },
  render: () => (
    <ActionSheet
      layout="grid"
      title="ثبت سریع"
      trigger={<Button>ثبت سریع</Button>}
      actions={[
        { key: 'expense', label: 'هزینه', icon: <ArrowUpLeft />, onSelect: () => toast.show('هزینه') },
        { key: 'income', label: 'درآمد', icon: <ArrowDownLeft />, onSelect: () => toast.show('درآمد') },
        { key: 'transfer', label: 'انتقال', icon: <ArrowLeftRight />, onSelect: () => toast.show('انتقال') },
        { key: 'buy', label: 'خرید دارایی', icon: <Coins />, onSelect: () => toast.show('خرید') },
        { key: 'sell', label: 'فروش دارایی', icon: <Landmark />, onSelect: () => toast.show('فروش') },
        { key: 'convert', label: 'تبدیل', icon: <RefreshCw />, onSelect: () => toast.show('تبدیل') },
      ]}
    />
  ),
};

export const RowActions: Story = {
  name: 'ActionSheet (list)',
  render: () => (
    <ActionSheet
      trigger={<Button variant="secondary">گزینه‌های تراکنش</Button>}
      actions={[
        { key: 'edit', label: 'ویرایش', icon: <Pencil />, onSelect: () => {} },
        { key: 'dup', label: 'تکرار تراکنش', description: 'با تاریخ امروز', icon: <Copy />, onSelect: () => toast.success('تکرار شد') },
        { key: 'del', label: 'حذف', icon: <Trash2 />, tone: 'danger', onSelect: () => toast.error('حذف شد') },
      ]}
    />
  ),
};

function ConfirmDemo() {
  const confirm = useConfirm();
  return (
    <Button
      variant="danger"
      startIcon={<Trash2 />}
      onClick={async () => {
        const ok = await confirm({ title: 'این تراکنش حذف شود؟', description: 'موجودی کیف پول دوباره حساب می‌شود.', confirmLabel: 'حذف', tone: 'danger' });
        if (ok) toast.show('حذف شد', { action: { label: 'برگردان', onClick: () => {} } });
      }}
    >
      حذف تراکنش
    </Button>
  );
}

export const Confirm: Story = {
  name: 'useConfirm',
  parameters: { docs: { description: { story: '`const ok = await confirm({...})`. Prefer undo toasts over confirms for reversible actions.' } } },
  render: () => <ConfirmDemo />,
};

export const ConfirmControlled: Story = {
  name: 'ConfirmDialog',
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>علامت پرداخت</Button>
        <ConfirmDialog open={open} onOpenChange={setOpen} title="قسط مهر پرداخت شد؟" description="۵٬۲۰۰٬۰۰۰ تومان از بانک ملت کم می‌شود." confirmLabel="بله، پرداخت شد" onConfirm={() => toast.success('ثبت شد')} />
      </>
    );
  },
};

export const DialogStory: Story = {
  name: 'Dialog',
  render: () => (
    <Dialog trigger={<Button variant="secondary">درباره</Button>} title="خرجوک" description="نسخه ۲. دفتر پول و دارایی تو." actions={<Button>باشه</Button>} />
  ),
};

export const MenuStory: Story = {
  name: 'Menu',
  render: () => (
    <div className="flex justify-end">
      <Menu
        trigger={<IconButton aria-label="بیشتر" icon={<MoreHorizontal />} variant="secondary" />}
        items={[
          { key: 'edit', label: 'ویرایش', icon: <Pencil />, onSelect: () => {} },
          { key: 'dup', label: 'تکرار', icon: <Copy />, onSelect: () => {} },
          'separator',
          { key: 'del', label: 'حذف', icon: <Trash2 />, tone: 'danger', onSelect: () => {} },
        ]}
      />
    </div>
  ),
};

export const TooltipStory: Story = {
  name: 'Tooltip',
  render: () => (
    <div className="flex justify-center pt-8">
      <Tooltip content="بروزرسانی قیمت‌ها">
        <IconButton aria-label="بروزرسانی" icon={<RefreshCw />} variant="secondary" />
      </Tooltip>
    </div>
  ),
};
