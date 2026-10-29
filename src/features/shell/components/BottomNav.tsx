'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, CalendarDays, Home, Plus, Wallet } from 'lucide-react';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { NavItem } from '@/features/shell/components/NavItem';
import { haptic } from '@/shared/utils/haptics';

type Tab = 'home' | 'assets' | 'wallets' | 'deadlines' | null;

function useTabState(pathname: string): Tab {
  if (pathname === '/') return 'home';
  if (pathname === '/assets' || pathname.startsWith('/assets/')) return 'assets';
  if (pathname === '/wallets' || pathname.startsWith('/wallets/')) return 'wallets';
  if (pathname === '/deadlines' || pathname.startsWith('/deadlines/')) return 'deadlines';
  return null;
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoadingData } = useData();

  const active = useTabState(pathname);
  const navTo = (href: string) => {
    haptic('selection');
    router.push(href);
  };

  return (
    <nav className="absolute bottom-0 w-full bg-surface-shell/85 backdrop-blur-md border-t border-white/5 px-3 pt-2 flex justify-between items-center pb-safe z-40">
      <div className="flex justify-around flex-1 items-center">
        <NavItem
          icon={<Home size={21} strokeWidth={1.75} />}
          label="داشبورد"
          isActive={active === 'home'}
          onClick={() => navTo('/')}
        />
        <NavItem
          icon={<Activity size={21} strokeWidth={1.75} />}
          label="دارایی‌ها"
          isActive={active === 'assets'}
          onClick={() => navTo('/assets')}
        />
      </div>

      <div className="flex flex-col items-center justify-center px-2">
        <Link
          href="/transactions/new"
          onClick={() => haptic('selection')}
          aria-label="ثبت تراکنش جدید"
          aria-disabled={isLoadingData}
          tabIndex={isLoadingData ? -1 : undefined}
          className={`w-12 h-12 bg-zinc-50 hover:bg-white text-zinc-900 rounded-2xl flex justify-center items-center transition-transform active:scale-95 ${
            isLoadingData ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <Plus size={22} strokeWidth={2.25} />
        </Link>
      </div>

      <div className="flex justify-around flex-1 items-center">
        <NavItem
          icon={<Wallet size={21} strokeWidth={1.75} />}
          label="کیف پول‌ها"
          isActive={active === 'wallets'}
          onClick={() => navTo('/wallets')}
          disabled={isLoadingData}
        />
        <NavItem
          icon={<CalendarDays size={21} strokeWidth={1.75} />}
          label="سررسید"
          isActive={active === 'deadlines'}
          onClick={() => navTo('/deadlines')}
        />
      </div>
    </nav>
  );
}
