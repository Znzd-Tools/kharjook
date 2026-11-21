'use client';

import { useMemo, useState } from 'react';
import { Avatar, EmptyState, List, ListRow, SearchField, Section, Sheet } from '@/design-system';
import { Coins, Wallet as WalletIcon } from '@/design-system/icons';
import { NativeAmount } from '@/features/wallets/components/NativeAmount';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import { personCurrency } from '@/shared/utils/person-currency';
import type {
  Asset,
  Person,
  Transaction,
  Wallet,
} from '@/shared/types/domain';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { assetHolding } from '@/features/transactions/utils/convert-transaction';

export type EndpointKind = 'wallet' | 'asset' | 'person';

export interface EndpointSheetPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Which endpoint kinds this side accepts. */
  allow: EndpointKind[];
  /** IDs to hide (e.g. opposite side of a transfer). */
  excludeIds?: string[];
  wallets: Wallet[];
  assets: Asset[];
  persons: Person[];
  transactions: Transaction[];
  onSelect: (kind: EndpointKind, id: string) => void;
}

export function EndpointSheetPicker({
  open,
  onClose,
  title,
  allow,
  excludeIds = [],
  wallets,
  assets,
  persons,
  transactions,
  onSelect,
}: EndpointSheetPickerProps) {
  const [query, setQuery] = useState('');

  const exclude = useMemo(() => new Set(excludeIds.filter(Boolean)), [excludeIds]);

  const filteredWallets = useMemo(() => {
    if (!allow.includes('wallet')) return [];
    const q = query.trim().toLowerCase();
    return wallets
      .filter((w) => !exclude.has(w.id))
      .filter((w) =>
        q === ''
          ? true
          : w.name.toLowerCase().includes(q) ||
            w.currency.toLowerCase().includes(q)
      );
  }, [wallets, allow, exclude, query]);

  const assetHoldings = useMemo(() => {
    if (!allow.includes('asset')) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const asset of assets) {
      map.set(asset.id, assetHolding(asset.id, transactions));
    }
    return map;
  }, [assets, transactions, allow]);

  const filteredAssets = useMemo(() => {
    if (!allow.includes('asset')) return [];
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => !exclude.has(a.id))
      .filter((a) =>
        q === ''
          ? true
          : a.name.toLowerCase().includes(q) || a.unit.toLowerCase().includes(q)
      );
  }, [assets, allow, exclude, query]);

  // Same math as everywhere else (opening balance included).
  const personBalances = useMemo(() => {
    if (!allow.includes('person')) return new Map<string, number>();
    return new Map(persons.map((p) => [p.id, calculatePersonBalance(p, transactions)]));
  }, [persons, transactions, allow]);

  const filteredPersons = useMemo(() => {
    if (!allow.includes('person')) return [];
    const q = query.trim().toLowerCase();
    return persons
      .filter((person) => !exclude.has(person.id))
      .filter((person) =>
        q === '' ? true : person.name.toLowerCase().includes(q)
      );
  }, [persons, allow, exclude, query]);

  const handleSelect = (kind: EndpointKind, id: string) => {
    onSelect(kind, id);
    onClose();
    setQuery('');
  };

  const close = () => {
    onClose();
    setQuery('');
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={title}
      size="full"
      header={<SearchField value={query} onValueChange={setQuery} placeholder="جستجو" aria-label="جستجو" autoFocus />}
    >
      <div className="space-y-5">
        {allow.includes('wallet') && (
          <PickerSection label="کیف پول‌ها" empty={filteredWallets.length === 0 ? 'کیف پولی پیدا نشد' : null}>
            {filteredWallets.map((w) => (
              <ListRow
                key={w.id}
                onClick={() => handleSelect('wallet', w.id)}
                chevron={false}
                leading={<Avatar src={w.icon_url} name={w.name} fallback={<WalletIcon />} tone="lilac" />}
                title={w.name}
                trailing={<NativeAmount value={calculateWalletStats(w, transactions).balance} currency={w.currency} size="sm" compact />}
              />
            ))}
          </PickerSection>
        )}

        {allow.includes('asset') && (
          <PickerSection label="دارایی‌ها" empty={filteredAssets.length === 0 ? 'دارایی‌ای پیدا نشد' : null}>
            {filteredAssets.map((a) => {
              const holding = assetHoldings.get(a.id) ?? 0;
              return (
                <ListRow
                  key={a.id}
                  onClick={() => handleSelect('asset', a.id)}
                  chevron={false}
                  leading={<Avatar src={a.icon_url} name={a.name} fallback={<Coins />} tone="lemon" />}
                  title={a.name}
                  subtitle={a.unit}
                  trailing={<span className="tabular">{holding > 0 ? formatAssetAmount(holding, assetDecimals(a)) : '—'}</span>}
                />
              );
            })}
          </PickerSection>
        )}

        {allow.includes('person') && (
          <PickerSection label="اشخاص" empty={filteredPersons.length === 0 ? 'شخصی پیدا نشد' : null}>
            {filteredPersons.map((person) => {
              const balance = personBalances.get(person.id) ?? 0;
              const cur = personCurrency(person);
              const eps = cur === 'IRT' ? 0.5 : 0.005;
              return (
                <ListRow
                  key={person.id}
                  onClick={() => handleSelect('person', person.id)}
                  chevron={false}
                  leading={<Avatar name={person.name} tone="rose" />}
                  title={person.name}
                  subtitle={balance > eps ? 'به تو بدهکار است' : balance < -eps ? 'تو بدهکاری' : 'تسویه'}
                  trailing={
                    Math.abs(balance) > eps ? (
                      <NativeAmount value={Math.abs(balance)} currency={cur} size="sm" compact tone={balance > 0 ? 'positive' : 'negative'} />
                    ) : undefined
                  }
                />
              );
            })}
          </PickerSection>
        )}
      </div>
    </Sheet>
  );
}

function PickerSection({ label, empty, children }: { label: string; empty: string | null; children: React.ReactNode }) {
  return (
    <Section title={label}>
      {empty ? (
        <div className="rounded-card bg-panel">
          <EmptyState compact title={empty} />
        </div>
      ) : (
        <List>{children}</List>
      )}
    </Section>
  );
}
