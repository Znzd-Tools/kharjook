'use client';

/**
 * Archive: wallets and assets that are put away. They are not in any list,
 * form or total. Restore brings one back exactly as it was.
 */
import { useState } from 'react';
import { Avatar, Button, EmptyState, List, ListRow, Section, Text, TopBar } from '@/design-system';
import { Archive, ArchiveRestore, Coins, Wallet as WalletIcon } from '@/design-system/icons';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { assetHolding } from '@/features/transactions/utils/convert-transaction';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { NativeAmount } from '@/features/wallets/components/NativeAmount';
import { useArchive } from '../hooks/use-archive';

export function ArchiveView() {
  const goBack = useSafeBack('/wallets');
  const { archivedWallets, archivedAssets, transactions } = useData();
  const { restoreWallet, restoreAsset } = useArchive();
  const [busy, setBusy] = useState<string | null>(null);

  const restore = async (key: string, fn: () => Promise<boolean>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  const restoreButton = (key: string, name: string, fn: () => Promise<boolean>) => (
    <Button size="sm" variant="soft" startIcon={<ArchiveRestore />} loading={busy === key} aria-label={`بازگردانی ${name}`} onClick={() => void restore(key, fn)}>
      بازگردانی
    </Button>
  );

  const empty = archivedWallets.length === 0 && archivedAssets.length === 0;

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title="بایگانی" />
      <div className="space-y-5 px-(--ds-gutter)">
        <Text variant="caption" tone="subtle">
          موارد بایگانی‌شده در فهرست‌ها، فرم‌ها و هیچ جمعی نمی‌آیند. موجودی و تراکنش‌هایشان می‌ماند و با بازگردانی برمی‌گردند.
        </Text>

        {empty ? (
          <div className="rounded-card bg-panel">
            <EmptyState icon={<Archive />} title="بایگانی خالی است" description="از صفحه‌ی ویرایش کیف پول‌ها یا دارایی‌ها، دکمه‌ی بایگانی را بزن." />
          </div>
        ) : (
          <>
            {archivedWallets.length > 0 && (
              <Section title="کیف پول‌ها">
                <List>
                  {archivedWallets.map((w) => {
                    const balance = calculateWalletStats(w, transactions).balance;
                    return (
                      <ListRow
                        key={w.id}
                        chevron={false}
                        leading={<Avatar src={w.icon_url} name={w.name} fallback={<WalletIcon />} tone="mint" />}
                        title={w.name}
                        subtitle={
                          <span className="inline-flex items-center gap-1">
                            موجودی: <NativeAmount value={balance} currency={w.currency} size="xs" />
                          </span>
                        }
                        trailing={restoreButton(`w:${w.id}`, w.name, () => restoreWallet(w))}
                      />
                    );
                  })}
                </List>
              </Section>
            )}
            {archivedAssets.length > 0 && (
              <Section title="دارایی‌ها">
                <List>
                  {archivedAssets.map((a) => (
                    <ListRow
                      key={a.id}
                      chevron={false}
                      leading={<Avatar src={a.icon_url} name={a.name} fallback={<Coins />} tone="lemon" />}
                      title={a.name}
                      subtitle={`موجودی: ${formatAssetAmount(assetHolding(a.id, transactions), assetDecimals(a))} ${a.unit}`}
                      trailing={restoreButton(`a:${a.id}`, a.name, () => restoreAsset(a))}
                    />
                  ))}
                </List>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
