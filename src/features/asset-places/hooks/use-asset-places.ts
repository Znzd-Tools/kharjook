'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { assetHolding } from '@/features/transactions/utils/convert-transaction';
import { placementOf, type AssetPlace, type AssetPlaceHolding, type AssetPlaceKind, type Placement } from '../utils/placement';

/** Places, holdings and the placement of every asset, with the writes. */
export function useAssetPlaces() {
  const { user } = useAuth();
  const { assets, transactions } = useData();
  const [places, setPlaces] = useState<AssetPlace[]>([]);
  const [holdings, setHoldings] = useState<AssetPlaceHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([
      supabase.from('asset_places').select('*').is('archived_at', null).order('order_index', { ascending: true, nullsFirst: false }).order('created_at'),
      supabase.from('asset_place_holdings').select('*'),
    ]);
    if (p.error || h.error) {
      toast.error('محل دارایی‌ها دریافت نشد');
    } else {
      setPlaces((p.data ?? []) as AssetPlace[]);
      setHoldings((h.data ?? []) as AssetPlaceHolding[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.all([
      supabase.from('asset_places').select('*').is('archived_at', null).order('order_index', { ascending: true, nullsFirst: false }).order('created_at'),
      supabase.from('asset_place_holdings').select('*'),
    ]).then(([p, h]) => {
      if (!live) return;
      if (!p.error && !h.error) {
        setPlaces((p.data ?? []) as AssetPlace[]);
        setHoldings((h.data ?? []) as AssetPlaceHolding[]);
      }
      setIsLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const activePlaceIds = useMemo(() => new Set(places.map((p) => p.id)), [places]);

  /** Placement of each asset with a holding or with rows in a place. */
  const placements = useMemo(() => {
    const map = new Map<string, Placement>();
    for (const a of assets) {
      const rows = holdings.filter((h) => h.asset_id === a.id && activePlaceIds.has(h.place_id));
      const holding = assetHolding(a.id, transactions);
      if (holding <= 0 && rows.length === 0) continue;
      map.set(a.id, placementOf(holding, rows));
    }
    return map;
  }, [assets, holdings, transactions, activePlaceIds]);

  const savePlace = async (input: { id?: string; name: string; kind: AssetPlaceKind; note?: string | null }) => {
    if (!user) return false;
    const row = { name: input.name.trim(), kind: input.kind, note: input.note?.trim() || null, updated_at: new Date().toISOString() };
    const res = input.id
      ? await supabase.from('asset_places').update(row).eq('id', input.id)
      : await supabase.from('asset_places').insert({ ...row, user_id: user.id, order_index: places.length });
    if (res.error) {
      toast.error('ذخیره محل نشد');
      return false;
    }
    await load();
    return true;
  };

  const archivePlace = async (id: string) => {
    const { error } = await supabase.from('asset_places').update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast.error('حذف محل نشد');
    await load();
  };

  /** Set the quantity of one asset in one place (0 removes the row). */
  const setQuantity = async (assetId: string, placeId: string, quantity: number) => {
    if (!user) return false;
    const res =
      quantity > 0
        ? await supabase
            .from('asset_place_holdings')
            .upsert({ user_id: user.id, asset_id: assetId, place_id: placeId, quantity, updated_at: new Date().toISOString() }, { onConflict: 'asset_id,place_id' })
        : await supabase.from('asset_place_holdings').delete().eq('asset_id', assetId).eq('place_id', placeId);
    if (res.error) {
      toast.error('ذخیره نشد');
      return false;
    }
    return true;
  };

  /** Write several place quantities of one asset, then reload once. */
  const setQuantities = async (assetId: string, next: Map<string, number>) => {
    for (const [placeId, qty] of next) {
      if (!(await setQuantity(assetId, placeId, qty))) return false;
    }
    await load();
    return true;
  };

  return { places, holdings, placements, isLoading, reload: load, savePlace, archivePlace, setQuantities };
}
