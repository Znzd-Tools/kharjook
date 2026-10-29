'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Calculator,
  Coins,
  FileUp,
  LayoutGrid,
  Repeat,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { BottomSheet } from '@/shared/components/BottomSheet';

type MoreHubSheetProps = {
  open: boolean;
  onClose: () => void;
};

const LINKS = [
  {
    href: '/reports',
    title: 'گزارش‌ها',
    subtitle: 'جریان نقدی و سود/زیان دارایی',
    icon: BarChart3,
  },
  {
    href: '/prices',
    title: 'قیمت‌ها و نرخ‌ها',
    subtitle: 'قیمت روزانه و نرخ ارز',
    icon: TrendingUp,
  },
  {
    href: '/manage/assets',
    title: 'مدیریت دارایی‌ها',
    subtitle: 'افزودن، ویرایش و مرتب‌سازی',
    icon: Coins,
  },
  {
    href: '/plan',
    title: 'برنامه هزینه',
    subtitle: 'پیش‌بینی هزینه‌های ماهانه',
    icon: Calculator,
  },
  {
    href: '/manage/goals',
    title: 'اهداف تخصیص',
    subtitle: 'درصد یا مقدار هدف',
    icon: Target,
  },
  {
    href: '/manage/recurring',
    title: 'تراکنش‌های دوره‌ای',
    subtitle: 'حقوق، اجاره و … — ثبت خودکار',
    icon: Repeat,
  },
  {
    href: '/manage/import',
    title: 'ورود CSV',
    subtitle: 'درآمد و هزینه دسته‌ای',
    icon: FileUp,
  },
  {
    href: '/manage/categories',
    title: 'دسته‌بندی‌ها',
    subtitle: 'درآمد، هزینه و دارایی',
    icon: LayoutGrid,
  },
] as const;

export function MoreHubSheet({ open, onClose }: MoreHubSheetProps) {
  const router = useRouter();

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">بیشتر</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-2xl bg-surface-raised border border-white/5 divide-y divide-white/5 overflow-hidden">
          {LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  onClose();
                  router.push(item.href);
                }}
                className="w-full px-4 py-3.5 flex items-center gap-3.5 text-right hover:bg-surface-hover transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 text-zinc-300 flex items-center justify-center shrink-0">
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
