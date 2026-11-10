-- Personal MCP (Claude connector): one secret token per user, and a log of
-- every change made through it.
CREATE TABLE IF NOT EXISTS public.mcp_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcp_tokens_select_own ON public.mcp_tokens;
CREATE POLICY mcp_tokens_select_own ON public.mcp_tokens FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.mcp_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tool text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok boolean NOT NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_audit_user_idx ON public.mcp_audit (user_id, created_at DESC);
ALTER TABLE public.mcp_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcp_audit_select_own ON public.mcp_audit;
CREATE POLICY mcp_audit_select_own ON public.mcp_audit FOR SELECT USING (auth.uid() = user_id);
-- Writes to both tables only by the server (service role).
