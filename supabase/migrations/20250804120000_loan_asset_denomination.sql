-- Asset-denominated loans: installment amounts are quantity in the asset's unit.
-- NULL = fiat loan (existing currency path).
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS asset_id uuid NULL REFERENCES assets(id);

CREATE INDEX IF NOT EXISTS loans_asset_id_idx ON loans (asset_id)
  WHERE asset_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN loans.asset_id IS
  'When set, installment/total amounts are asset quantity (same unit as assets.unit); settle debits this asset 1:1.';
