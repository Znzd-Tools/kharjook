-- Allow expense plan items sourced from subscriptions.

ALTER TABLE expense_plan_items
  DROP CONSTRAINT IF EXISTS expense_plan_items_source_type_check;

ALTER TABLE expense_plan_items
  ADD CONSTRAINT expense_plan_items_source_type_check
  CHECK (source_type IN ('manual', 'installment', 'recurring', 'check', 'subscription'));
