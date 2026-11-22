'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { assetHolding } from '@/features/transactions/utils/convert-transaction';
import { assetDecimals } from '@/shared/utils/format-asset-amount';
import { placeTolerance, placementOf, type AssetPlace, type AssetPlaceHolding, type AssetPlaceKind, type Placement } from '../utils/placement';

interface AssetPlacesValue {
  places: AssetPlace[];
  holdings: AssetPlaceHolding[];
  placements: Map<string, Placement>;
  /** Noise limit per asset id (half its smallest shown unit). */
  tolerances: Map<string, number>;
  isLoading: boolean;
  /** Bumps after each load; the reconciler acts only on fresh rows. */
  loadedFor: unknown;
  reload: () => Promise<void>;
  savePlace: (input: { id?: string; name: string; kind: AssetPlaceKind; note?: string | null }) => Promise<boolean>;
  archivePlace: (id: string) => Promise<void>;
  setQuantities: (assetId: string, next: Map<string, number>) => Promise<boolean>;
}

const Ctx = createContext<AssetPlacesValue | null>(null);

const fetchAll = () =>
  Promise.all([
    supabase.from('asset_places').select('*').is('archived_at', null).order('order_index', { ascending: true, nullsFirst: false }).order('created_at'),
    supabase.from('asset_place_holdings').select('*'),
  ]);

/** One shared copy of places and holdings for every screen. */
export function AssetPlacesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { assets, transactions } = useData();
  const [places, setPlaces] = useState<AssetPlace[]>([]);
  const [holdings, setHoldings] = useState<AssetPlaceHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);
  const txRef = useRef(transactions);
  useEffect(() => {
    txRef.current = transactions;
  }, [transactions]);

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchAll>>, marker: unknown) => {
    const [p, h] = res;
    if (p.error || h.error) {
      setIsLoading(false);
      return false;
    }
    setPlaces((p.data ?? []) as AssetPlace[]);
    setHoldings((h.data ?? []) as AssetPlaceHolding[]);
    setLoadedFor(marker);
    setIsLoading(false);
    return true;
  }, []);

  const reload = useCallback(async () => {
    if (!apply(await fetchAll(), txRef.current)) toast.error('محل دارایی‌ها دریافت نشد');
  }, [apply]);

  // Reload after every ledger change: another device or tab may have moved
  // things, and the reconciler must never act on old rows.
  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchAll().then((res) => {
      if (live) apply(res, transactions);
    });
    return () => {
      live = false;
    };
  }, [user, transactions, apply]);

  const activePlaceIds = useMemo(() => new Set(places.map((p) => p.id)), [places]);
  const tolerances = useMemo(() => new Map(assets.map((a) => [a.id, placeTolerance(assetDecimals(a))])), [assets]);

  const placements = useMemo(() => {
    const map = new Map<string, Placement>();
    for (const a of assets) {
      const rows = holdings.filter((h) => h.asset_id === a.id && activePlaceIds.has(h.place_id));
      const holding = assetHolding(a.id, transactions);
      if (holding <= 0 && rows.length === 0) continue;
      map.set(a.id, placementOf(holding, rows, tolerances.get(a.id)));
    }
    return map;
  }, [assets, holdings, transactions, activePlaceIds, tolerances]);

  const savePlace = useCallback(
    async (input: { id?: string; name: string; kind: AssetPlaceKind; note?: string | null }) => {
      if (!user) return false;
      const row = { name: input.name.trim(), kind: input.kind, note: input.note?.trim() || null, updated_at: new Date().toISOString() };
      const res = input.id
        ? await supabase.from('asset_places').update(row).eq('id', input.id)
        : await supabase.from('asset_places').insert({ ...row, user_id: user.id, order_index: places.length });
      if (res.error) {
        toast.error('ذخیره محل نشد');
        return false;
      }
      await reload();
      return true;
    },
    [user, places.length, reload]
  );

  const archivePlace = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('asset_places').update({ archived_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        toast.error('حذف محل نشد');
        return;
      }
      await reload();
    },
    [reload]
  );

  /** Write the place quantities of one asset (0 removes the row), then reload once. */
  const setQuantities = useCallback(
    async (assetId: string, next: Map<string, number>) => {
      if (!user) return false;
      for (const [placeId, quantity] of next) {
        const res =
          quantity > 0
            ? await supabase
                .from('asset_place_holdings')
                .upsert({ user_id: user.id, asset_id: assetId, place_id: placeId, quantity, updated_at: new Date().toISOString() }, { onConflict: 'asset_id,place_id' })
            : await supabase.from('asset_place_holdings').delete().eq('asset_id', assetId).eq('place_id', placeId);
        if (res.error) {
          toast.error('ذخیره نشد');
          await reload();
          return false;
        }
      }
      await reload();
      return true;
    },
    [user, reload]
  );

  const value = useMemo(
    () => ({ places, holdings, placements, tolerances, isLoading, loadedFor, reload, savePlace, archivePlace, setQuantities }),
    [places, holdings, placements, tolerances, isLoading, loadedFor, reload, savePlace, archivePlace, setQuantities]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssetPlacesContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAssetPlaces needs AssetPlacesProvider');
  return v;
}
