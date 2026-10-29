'use client';

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Repeat2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { IconBadge, ListRow, Money } from '@/shared/components/ui';
import type { Asset, Category, Person, Transaction, Wallet } from '@/shared/types/domain';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { formatCurrencyAmount } from '@/shared/utils/format-currency';
import { formatJalaaliHuman, parseJalaali } from '@/shared/utils/jalali';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import type { ConvertTransactionGroup } from '@/features/transactions/utils/convert-transaction';

export interface TransactionLookup {
  wallets: Wallet[];
  assets: Asset[];
  categories: Category[];
  persons: Person[];
}

type Side = 'source' | 'target';

function endpoint(tx: Transaction, side: Side, lookup: TransactionLookup) {
  const walletId = side === 'source' ? tx.source_wallet_id : tx.target_wallet_id;
  const assetId = side === 'source' ? tx.source_asset_id : tx.target_asset_id;
  const personId = side === 'source' ? tx.source_person_id : tx.target_person_id;
  const amount = Number(side === 'source' ? tx.source_amount : tx.target_amount) || 0;
  if (walletId) {
    const wallet = lookup.wallets.find((w) => w.id === walletId);
    const meta = wallet ? CURRENCY_META[wallet.currency] : CURRENCY_META.IRT;
    const value = formatCurrencyAmount(amount, wallet?.currency ?? 'IRT');
    return {
      name: wallet?.name ?? 'کیف پول حذف‌شده',
      amountLabel: meta.code === 'IRT' ? `${value} ت` : `${meta.symbol}${value}`,
    };
  }
  if (assetId) {
    const asset = lookup.assets.find((a) => a.id === assetId);
    return {
      name: asset?.name ?? 'دارایی حذف‌شده',
      amountLabel: `${formatAssetAmount(amount, assetDecimals(asset))} ${asset?.unit ?? ''}`.trim(),
      asset,
    };
  }
  if (personId) {
    const person = lookup.persons.find((p) => p.id === personId);
    return {
      name: person?.name ?? 'شخص حذف‌شده',
      amountLabel: `${formatCurrencyAmount(amount, 'IRT')} ت`,
    };
  }
  return null;
}

/** Turns one ledger row into the title / subtitle / amount a person reads. */
export function describeTransaction(tx: Transaction, lookup: TransactionLookup) {
  const src = endpoint(tx, 'source', lookup);
  const dst = endpoint(tx, 'target', lookup);
  const category = tx.category_id ? lookup.categories.find((c) => c.id === tx.category_id) : null;
  const note = tx.note?.trim();

  switch (tx.type) {
    case 'EXPENSE':
      return {
        title: note || category?.name || 'هزینه',
        subtitle: [note ? category?.name : null, src?.name].filter(Boolean).join(' · '),
        amount: `−${src?.amountLabel ?? ''}`,
        tone: 'negative' as const,
        color: category?.color ?? '#f43f5e',
        icon: <ArrowUpRight size={18} strokeWidth={2} />,
      };
    case 'INCOME':
      return {
        title: note || category?.name || 'درآمد',
        subtitle: [note ? category?.name : null, dst?.name].filter(Boolean).join(' · '),
        amount: `+${dst?.amountLabel ?? ''}`,
        tone: 'positive' as const,
        color: category?.color ?? '#10b981',
        icon: <ArrowDownLeft size={18} strokeWidth={2} />,
      };
    case 'BUY':
      return {
        title: `خرید ${dst?.name ?? ''}`,
        subtitle: [src?.amountLabel, src?.name ? `از ${src.name}` : null].filter(Boolean).join(' · '),
        amount: `+${dst?.amountLabel ?? ''}`,
        tone: 'neutral' as const,
        asset: dst?.asset,
        icon: <ArrowDownLeft size={18} strokeWidth={2} />,
      };
    case 'SELL':
      return {
        title: `فروش ${src?.name ?? ''}`,
        subtitle: [src?.amountLabel, dst?.name ? `به ${dst.name}` : null].filter(Boolean).join(' · '),
        amount: `+${dst?.amountLabel ?? ''}`,
        tone: 'positive' as const,
        asset: src?.asset,
        icon: <ArrowUpRight size={18} strokeWidth={2} />,
      };
    default:
      return {
        title: note || 'انتقال',
        subtitle: `${src?.name ?? '—'} ← ${dst?.name ?? '—'}`,
        amount: src?.amountLabel ?? dst?.amountLabel ?? '',
        tone: 'neutral' as const,
        icon: <ArrowLeftRight size={18} strokeWidth={2} />,
      };
  }
}

export function TransactionListItem({
  tx,
  lookup,
  href,
  showDate = false,
}: {
  tx: Transaction;
  lookup: TransactionLookup;
  href?: string;
  showDate?: boolean;
}) {
  const d = describeTransaction(tx, lookup);
  let leading: ReactNode;
  if ('asset' in d && d.asset) {
    leading = (
      <EntityIcon
        iconUrl={d.asset.icon_url}
        fallback={d.icon}
        bgColor="rgba(255,255,255,0.06)"
        color="#d4d4d8"
        className="h-10 w-10 rounded-full!"
      />
    );
  } else {
    leading = <IconBadge color={'color' in d ? d.color : undefined}>{d.icon}</IconBadge>;
  }
  const date = showDate ? formatDate(tx.date_string) : null;
  return (
    <ListRow
      href={href}
      leading={leading}
      title={d.title}
      subtitle={[d.subtitle, date].filter(Boolean).join(' · ') || undefined}
      trailing={<Money tone={d.tone}>{d.amount}</Money>}
    />
  );
}

export function ConvertListItem({
  group,
  lookup,
  href,
}: {
  group: ConvertTransactionGroup;
  lookup: TransactionLookup;
  href?: string;
}) {
  const sold = endpoint(group.sell, 'source', lookup);
  const bought = endpoint(group.buy, 'target', lookup);
  return (
    <ListRow
      href={href}
      leading={
        <IconBadge color="#8b5cf6">
          <Repeat2 size={18} strokeWidth={2} />
        </IconBadge>
      }
      title={`تبدیل ${sold?.name ?? ''} به ${bought?.name ?? ''}`}
      subtitle={`−${sold?.amountLabel ?? ''}`}
      trailing={<Money>+{bought?.amountLabel}</Money>}
    />
  );
}

function formatDate(dateString: string) {
  const parsed = parseJalaali(dateString);
  return parsed ? formatJalaaliHuman(parsed) : dateString;
}
