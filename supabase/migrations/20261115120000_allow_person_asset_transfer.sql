-- Allow TRANSFER between a person and an asset (both directions).
-- Same shape rules as before; only the two person<->asset blocks are removed.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_shape_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_shape_check CHECK (
  CASE type
    WHEN 'TRANSFER' THEN
      ((CASE WHEN source_wallet_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN source_asset_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN source_person_id IS NOT NULL THEN 1 ELSE 0 END) = 1)
      AND
      ((CASE WHEN target_wallet_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN target_asset_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN target_person_id IS NOT NULL THEN 1 ELSE 0 END) = 1)
    WHEN 'INCOME' THEN
      source_wallet_id IS NULL AND source_asset_id IS NULL AND source_person_id IS NULL
      AND ((CASE WHEN target_wallet_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN target_asset_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN target_person_id IS NOT NULL THEN 1 ELSE 0 END) = 1)
    WHEN 'EXPENSE' THEN
      target_wallet_id IS NULL AND target_asset_id IS NULL AND target_person_id IS NULL
      AND ((CASE WHEN source_wallet_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN source_asset_id IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN source_person_id IS NOT NULL THEN 1 ELSE 0 END) = 1)
    WHEN 'BUY' THEN target_asset_id IS NOT NULL
    WHEN 'SELL' THEN source_asset_id IS NOT NULL
    ELSE true
  END
);
