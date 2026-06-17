-- Monthly expense planning: manual line items + imported suggestions per Jalali month.

CREATE TABLE IF NOT EXISTS expense_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  month_start_string text NOT NULL,
  title text NOT NULL,
  amount_toman numeric NOT NULL CHECK (amount_toman > 0),
  category_id uuid REFERENCES categories (id) ON DELETE SET NULL,
  note text,
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'installment', 'recurring', 'check')),
  source_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_plan_items_user_month_idx
  ON expense_plan_items (user_id, month_start_string, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS expense_plan_items_source_unique_idx
  ON expense_plan_items (user_id, month_start_string, source_type, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE expense_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY expense_plan_items_select_own ON expense_plan_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY expense_plan_items_insert_own ON expense_plan_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY expense_plan_items_update_own ON expense_plan_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY expense_plan_items_delete_own ON expense_plan_items
  FOR DELETE USING (auth.uid() = user_id);
