import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendarDays, Home, MoreHorizontal, PieChart, Receipt, Search, Settings } from '../icons';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { Fab } from './Fab';
import { IconButton } from './IconButton';
import { TabBar } from './TabBar';
import { Tabs } from './Tabs';
import { TopBar } from './TopBar';
import { toast } from './Toast';

const meta = { title: 'Navigation', tags: ['autodocs'] } satisfies Meta;
export default meta;
type Story = StoryObj;

export const TopBars: Story = {
  name: 'TopBar',
  parameters: { layout: 'fullscreen', docs: { description: { story: 'Each page owns its header (no global app header). Tab roots use `large`; pushed pages use `inline` + back.' } } },
  render: () => (
    <div className="space-y-6">
      <TopBar
        variant="large"
        title="سبد"
        subtitle="۱۲ دارایی · ۴ کیف پول"
        actions={<IconButton aria-label="جستجو" icon={<Search />} />}
        sticky={false}
      />
      <TopBar onBack={() => {}} title="بانک ملت" subtitle="حساب جاری" actions={<IconButton aria-label="بیشتر" icon={<MoreHorizontal />} />} sticky={false} />
      <TopBar leading={<Avatar name="علی" shape="circle" size="sm" />} actions={<IconButton aria-label="تنظیمات" icon={<Settings />} />} sticky={false} />
    </div>
  ),
};

export const BottomNav: Story = {
  name: 'TabBar + Fab',
  parameters: { layout: 'fullscreen', docs: { description: { story: '4 tabs + center FAB. Tap FAB = add expense. Long-press FAB = quick actions.' } } },
  render: function Render() {
    const [tab, setTab] = useState('home');
    return (
      <div className="flex h-[420px] flex-col justify-end">
        <TabBar
          activeKey={tab}
          onSelect={setTab}
          items={[
            { key: 'home', label: 'خانه', icon: <Home /> },
            { key: 'ledger', label: 'تراکنش‌ها', icon: <Receipt /> },
            { key: 'portfolio', label: 'سبد', icon: <PieChart /> },
            { key: 'plan', label: 'برنامه', icon: <CalendarDays />, badge: 3 },
          ]}
          center={<Fab aria-label="ثبت هزینه" onPress={() => toast.show('ثبت هزینه')} onLongPress={() => toast.show('ثبت سریع (منو)')} />}
        />
      </div>
    );
  },
};

export const TabsStory: Story = {
  name: 'Tabs',
  render: () => (
    <Tabs
      defaultValue="loans"
      items={[
        { value: 'loans', label: 'وام‌ها', count: 2 },
        { value: 'checks', label: 'چک‌ها', count: 5 },
        { value: 'subs', label: 'اشتراک‌ها' },
        { value: 'people', label: 'اشخاص' },
      ]}
      panels={{
        loans: <p className="text-callout text-fg-muted">لیست وام‌ها</p>,
        checks: <p className="text-callout text-fg-muted">لیست چک‌ها</p>,
        subs: <p className="text-callout text-fg-muted">لیست اشتراک‌ها</p>,
        people: <p className="text-callout text-fg-muted">لیست اشخاص</p>,
      }}
    />
  ),
};
