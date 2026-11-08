'use client';

import { useFlag } from '@/shared/lib/flags/client';
import { PlanTabV2 } from '@/features/deadlines/v2/PlanTabV2';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  ChevronLeft,
  HandCoins,
  ReceiptText,
  Repeat,
} from 'lucide-react';

type DeadlineItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  href?: string;
  disabled?: boolean;
};

const DEADLINE_ITEMS: DeadlineItem[] = [
  {
    key: 'loans',
    title: 'اقساط و وام‌ها',
    subtitle: 'مدیریت پرداخت‌های دوره‌ای و اقساط',
    icon: <CalendarClock size={20} />,
    href: '/deadlines/loans',
  },
  {
    key: 'persons',
    title: 'اشخاص',
    subtitle: 'مدیریت طلب و بدهی اشخاص',
    icon: <HandCoins size={20} />,
    href: '/deadlines/persons',
  },
  {
    key: 'checks',
    title: 'چک‌ها',
    subtitle: 'ثبت و پیگیری چک‌های صادره',
    icon: <ReceiptText size={20} />,
    href: '/deadlines/checks',
  },
  {
    key: 'subscriptions',
    title: 'اشتراک‌ها',
    subtitle: 'مدیریت اشتراک‌های دوره‌ای',
    icon: <Repeat size={20} />,
    href: '/deadlines/subscriptions',
  },
];

function DeadlinesItem({
  item,
  onClick,
}: {
  item: DeadlineItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={onClick}
      className={`w-full bg-panel border border-white/5 p-4 rounded-2xl flex items-center justify-between text-right transition-colors ${
        item.disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-elevated hover:border-purple-500/20'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            item.disabled
              ? 'bg-slate-500/10 text-slate-500'
              : 'bg-purple-500/10 text-purple-400'
          }`}
        >
          {item.icon}
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-200">{item.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
        </div>
      </div>
      <ChevronLeft
        size={20}
        className={item.disabled ? 'text-slate-700' : 'text-slate-600'}
      />
    </button>
  );
}

export function DeadlinesTab() {
  const v2 = useFlag('v2.plan');
  if (v2) return <PlanTabV2 />;
  return <DeadlinesTabV1 />;
}

function DeadlinesTabV1() {
  const router = useRouter();
  return (
    <div className="p-6 animate-[fade-in_300ms_ease-out] space-y-6">
      <h2 className="text-xl font-bold text-white mb-2">سررسید</h2>

      <div className="space-y-3">
        {DEADLINE_ITEMS.map((item) => (
          <DeadlinesItem
            key={item.key}
            item={item}
            onClick={() => {
              if (!item.href) return;
              router.push(item.href);
            }}
          />
        ))}
      </div>
    </div>
  );
}
