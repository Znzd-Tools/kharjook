-- Basket goals: one allocation % for a hand-picked set of assets
-- ("a, b, c, d together = 40% of the portfolio").
-- scope = 'basket': name + asset_ids (2 or more), allocation_percent only.
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS asset_ids uuid[];

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_scope_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_scope_check
  CHECK (scope = ANY (ARRAY['asset'::text, 'asset_group'::text, 'basket'::text]));

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_scope_target_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_scope_target_check CHECK (
  (
    scope = 'asset' AND asset_id IS NOT NULL AND category_id IS NULL AND asset_ids IS NULL AND (
      (target_kind = 'quantity' AND target_quantity IS NOT NULL AND target_quantity > 0 AND target_percent IS NULL)
      OR (target_kind = 'allocation_percent' AND target_percent IS NOT NULL AND target_percent > 0 AND target_percent <= 100 AND target_quantity IS NULL)
    )
  )
  OR (
    scope = 'asset_group' AND asset_id IS NULL AND category_id IS NOT NULL AND asset_ids IS NULL
    AND target_kind = 'allocation_percent' AND target_percent IS NOT NULL AND target_percent > 0 AND target_percent <= 100 AND target_quantity IS NULL
  )
  OR (
    scope = 'basket' AND asset_id IS NULL AND category_id IS NULL
    AND asset_ids IS NOT NULL AND cardinality(asset_ids) >= 2
    AND name IS NOT NULL AND char_length(trim(name)) > 0
    AND target_kind = 'allocation_percent' AND target_percent IS NOT NULL AND target_percent > 0 AND target_percent <= 100 AND target_quantity IS NULL
  )
);

-- A deleted asset leaves its baskets (no FK on array items).
CREATE OR REPLACE FUNCTION public.goals_drop_deleted_asset() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.goals SET asset_ids = array_remove(asset_ids, OLD.id), updated_at = now()
    WHERE scope = 'basket' AND OLD.id = ANY (asset_ids) AND cardinality(asset_ids) > 2;
  DELETE FROM public.goals WHERE scope = 'basket' AND OLD.id = ANY (asset_ids);
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS goals_drop_deleted_asset ON public.assets;
CREATE TRIGGER goals_drop_deleted_asset AFTER DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.goals_drop_deleted_asset();
