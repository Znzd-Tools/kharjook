'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Settings2, Wallet as WalletIcon } from 'lucide-react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { EmptyState } from '@/shared/components/EmptyState';
import { RouteSkeleton } from '@/shared/components/RouteSkeleton';
import { IconButton, ListGroup, ListRow, Money, Page } from '@/shared/components/ui';
import { PortfolioSwitcher } from '@/features/portfolio/components/PortfolioSwitcher';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { walletRateNow } from '@/features/rates/utils/wallet-rate';
import { formatCurrency, formatCurrencyAmount } from '@/shared/utils/format-currency';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';

export function WalletsTab() {
  const router = useRouter();
  const { wallets, transactions, currencyRates, isLoadingData } = useData();
  const { currencyMode, usdRate } = useUI();
  const rateHistories = useRateHistories();

  const rows = useMemo(() => {
    return wallets.map((w) => {
      const stats = calculateWalletStats(w, transactions);
      const meta = CURRENCY_META[w.currency];
      // Saved rate, else last known rate from history, else 0 (warned below).
      const { rate, source: rateSource } = walletRateNow(w.currency, currencyRates, rateHistories);
      const balanceToman = stats.balance * rate;
      return { wallet: w, meta, stats, balanceToman, rate, rateSource };
    });
  }, [wallets, transactions, currencyRates, rateHistories]);

  const totalToman = rows.reduce((acc, r) => acc + r.balanceToman, 0);
  // Shares are of money actually held; overdrawn wallets would push them past 100%.
  const positiveToman = rows.reduce((acc, r) => acc + Math.max(0, r.balanceToman), 0);
  const totalUsd = usdRate > 0 ? totalToman / usdRate : 0;
  const displayTotal = currencyMode === 'USD' ? totalUsd : totalToman;

  const hasMissingRate = rows.some((r) => r.wallet.currency !== 'IRT' && r.rate === 0);

  return (
    <Page>
      <PortfolioSwitcher value="wallets" />

      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">
            جمع نقد · به {currencyMode === 'USD' ? 'دلار' : 'تومان'}
          </p>
          <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight text-zinc-50">
            <Money>{formatCurrency(displayTotal, currencyMode)}</Money>
          </p>
        </div>
        <IconButton label="مدیریت کیف پول‌ها" href="/manage/wallets">
          <Settings2 size={19} strokeWidth={1.75} />
        </IconButton>
      </div>

      {hasMissingRate && (
        <Link
          href="/prices"
          className="flex items-start gap-3 rounded-2xl bg-amber-400/8 px-4 py-3 text-xs leading-5 text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <span>
            نرخ تبدیل بعضی ارزها ثبت نشده و در جمع حساب نشده‌اند.{' '}
            <span className="font-medium text-amber-100 underline underline-offset-2">ثبت نرخ</span>
          </span>
        </Link>
      )}

      {isLoadingData && wallets.length === 0 && <RouteSkeleton blocks={3} compact />}

      {!isLoadingData && wallets.length === 0 && (
        <EmptyState
          icon={<WalletIcon size={24} />}
          title="هنوز کیف پولی نساخته‌ای."
          description="حساب بانکی، کارت یا پول نقد — هر جایی که پول نگه می‌داری."
          actionLabel="افزودن کیف پول"
          onAction={() => router.push('/manage/wallets')}
        />
      )}

      {wallets.length > 0 && (
        <ListGroup>
          {rows.map(({ wallet, meta, stats, balanceToman }) => {
            const balanceDisplay =
              currencyMode === 'USD' && usdRate > 0 ? balanceToman / usdRate : balanceToman;
            const isHome = wallet.currency === 'IRT';
            return (
              <ListRow
                key={wallet.id}
                href={`/wallets/${wallet.id}`}
                leading={
                  <EntityIcon
                    iconUrl={wallet.icon_url}
                    fallback={<WalletIcon size={18} />}
                    bgColor="rgba(255,255,255,0.06)"
                    color="#d4d4d8"
                    className="h-10 w-10 rounded-full!"
                  />
                }
                title={wallet.name}
                subtitle={
                  isHome ? (
                    meta.label
                  ) : (
                    <Money>
                      {meta.symbol}
                      {formatCurrencyAmount(stats.balance, wallet.currency)} {wallet.currency}
                    </Money>
                  )
                }
                trailing={
                  <Money tone={balanceDisplay < 0 ? 'negative' : 'neutral'}>
                    {formatCurrency(balanceDisplay, currencyMode)}
                  </Money>
                }
                trailingSub={
                  positiveToman > 0 && balanceToman > 0
                    ? `${((balanceToman / positiveToman) * 100).toFixed(0)}٪ از نقد`
                    : undefined
                }
              />
            );
          })}
        </ListGroup>
      )}
    </Page>
  );
}
