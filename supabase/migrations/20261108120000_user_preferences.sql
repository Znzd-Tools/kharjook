-- Per-user UI preferences (UX v2). Additive: no existing table changes.
--
-- dashboard_layout: { "order": ["hero", "attention", ...], "hidden": ["movers"] }
-- Block keys are defined in src/features/dashboard/v2/blocks.ts. Unknown
-- keys are ignored by the client, so old layouts never break the app.

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  dashboard_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_select_own ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_preferences_insert_own ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_preferences_update_own ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY user_preferences_delete_own ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);
