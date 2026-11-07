import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Plus, Receipt } from '../icons';
import { Banner } from './Banner';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton, SkeletonList } from './Skeleton';
import { Spinner } from './Spinner';
import { toast } from './Toast';

const meta = { title: 'Feedback', tags: ['autodocs'] } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Toasts: Story = {
  parameters: { docs: { description: { story: 'Call `toast.success()` from anywhere (no hook). Errors have high priority. Add an action for undo. Toasts sit above the tab bar.' } } },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => toast.success('تراکنش ثبت شد')}>موفق</Button>
      <Button variant="secondary" onClick={() => toast.error('ثبت نشد', { description: 'اتصال اینترنت را بررسی کن.' })}>خطا</Button>
      <Button variant="secondary" onClick={() => toast.warning('بودجه تفریح از سقف گذشت')}>هشدار</Button>
      <Button variant="secondary" onClick={() => toast.show('تراکنش حذف شد', { action: { label: 'برگردان', onClick: () => toast.success('برگشت') } })}>با Undo</Button>
    </div>
  ),
};

export const Banners: Story = {
  render: () => (
    <div className="space-y-3">
      <Banner tone="warning" title="نرخ دلار امروز ثبت نشده" action={<Button size="sm" variant="link">ثبت نرخ</Button>}>ارزش دلاری سبد با نرخ دیروز حساب شده.</Banner>
      <Banner tone="negative" title="چک ۱۲ مهر برگشت خورد" onDismiss={() => {}} />
      <Banner tone="positive">همه سررسیدهای این ماه پرداخت شد.</Banner>
      <Banner tone="info" onDismiss={() => {}}>اتصال تلگرام فعال است.</Banner>
      <Banner tone="accent" title="پیشنهاد">برای هدف طلا، ۸ میلیون تومان خرید کن.</Banner>
    </div>
  ),
};

export const Empty: Story = {
  name: 'EmptyState',
  render: () => (
    <div className="space-y-4">
      <div className="rounded-card bg-panel">
        <EmptyState icon={<Receipt />} title="هنوز تراکنشی نداری" description="اولین هزینه یا درآمد را ثبت کن تا تصویر ماهت ساخته شود." action={<Button startIcon={<Plus />}>ثبت تراکنش</Button>} secondaryAction={<Button variant="link" size="sm">ورود از CSV</Button>} />
      </div>
      <div className="rounded-card bg-panel">
        <EmptyState compact title="چیزی پیدا نشد" description="فیلترها را تغییر بده." />
      </div>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-fg-muted"><Spinner size="sm" /><Spinner /><Spinner size="lg" /></div>
      <div className="space-y-2 rounded-card bg-panel p-4">
        <Skeleton shape="text" className="w-20" />
        <Skeleton shape="text" className="h-8 w-48" />
      </div>
      <SkeletonList rows={3} />
    </div>
  ),
};
