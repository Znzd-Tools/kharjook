'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Amount, Avatar, Banner, Button, EmptyState, IconButton, List, ListRow, Section, Skeleton, Text } from '@/design-system';
import { Settings, Wallet as WalletIcon } from '@/design-system/icons';
import { NativeAmount } from './NativeAmount';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { walletRateNow } from '@/features/rates/utils/wallet-rate';

export function WalletsTab() {
  const router = useRouter();
  const { wallets, transactions, currencyRates, isLoadingData } = useData();
  const { currencyMode, usdRate } = useUI();
  const rateHistories = useRateHistories();

  const rows = useMemo(() => {
    return wallets.map((w) => {
      const stats = calculateWalletStats(w, transactions);
      // Saved rate, else last known rate from history, else 0 (warned below).
      const { rate, source: rateSource } = walletRateNow(w.currency, currencyRates, rateHistories);
      const balanceToman = stats.balance * rate;
      return { wallet: w, stats, balanceToman, rate, rateSource };
    });
  }, [wallets, transactions, currencyRates, rateHistories]);

  const totalToman = rows.reduce((acc, r) => acc + r.balanceToman, 0);
  const totalUsd = usdRate > 0 ? totalToman / usdRate : 0;
  const displayTotal = currencyMode === 'USD' ? totalUsd : totalToman;

  const hasMissingRate = rows.some((r) => r.wallet.currency !== 'IRT' && r.rate === 0);

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-6">
      <section aria-label="جمع کل نقد" className="rounded-card bg-panel p-5">
        <Text variant="caption" tone="subtle">
          جمع کل نقد (به {currencyMode === 'USD' ? 'دلار' : 'تومان'})
        </Text>
        <Amount value={displayTotal} currency={currencyMode} size="hero" />
      </section>

      {hasMissingRate && (
        <Banner
          tone="warning"
          action={
            <Button size="sm" variant="soft" onClick={() => router.push('/prices')}>
              قیمت‌ها و نرخ‌ها
            </Button>
          }
        >
          برای بعضی ارزها نرخ تبدیل نیست؛ جمع کل ناقص است.
        </Banner>
      )}

      <Section
        title="کیف پول‌ها"
        action={<IconButton size="sm" variant="ghost" aria-label="مدیریت کیف پول‌ها" icon={<Settings />} onClick={() => router.push('/manage/wallets')} />}
      >
        {isLoadingData && wallets.length === 0 && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-card" />
            ))}
          </div>
        )}

        {!isLoadingData && wallets.length === 0 && (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<WalletIcon />}
              title="هنوز کیف پولی نساخته‌ای"
              action={<Button onClick={() => router.push('/manage/wallets')}>افزودن کیف پول</Button>}
            />
          </div>
        )}

        {wallets.length > 0 && (
          <List>
            {rows.map(({ wallet, stats, balanceToman }) => {
              const balanceDisplay = currencyMode === 'USD' && usdRate > 0 ? balanceToman / usdRate : balanceToman;
              const native = wallet.currency !== (currencyMode === 'USD' ? 'USD' : 'IRT');
              return (
                <ListRow
                  key={wallet.id}
                  onClick={() => router.push(`/wallets/${wallet.id}`)}
                  leading={<Avatar src={wallet.icon_url} name={wallet.name} fallback={<WalletIcon />} tone="lilac" />}
                  title={wallet.name}
                  subtitle={
                    wallet.archived_at ? 'بایگانی‌شده' : native ? <NativeAmount value={stats.balance} currency={wallet.currency} size="xs" /> : undefined
                  }
                  trailing={<Amount value={balanceDisplay} currency={currencyMode} size="sm" compact />}
                />
              );
            })}
          </List>
        )}
      </Section>
    </div>
  );
}
