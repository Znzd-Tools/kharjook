-- Bank SMS inbox (auto import, option 2). Additive.
-- A phone forwarder app posts each bank SMS to /api/sms/ingest with a
-- personal token. Rows wait as "new" until the user confirms or ignores.
-- OTP / password messages are dropped before they reach this table.

CREATE TABLE IF NOT EXISTS public.sms_ingest_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.sms_ingest_tokens ENABLE ROW LEVEL SECURITY;
-- Only the server (service role) reads tokens. Users may see that one exists.
DROP POLICY IF EXISTS sms_ingest_tokens_select_own ON public.sms_ingest_tokens;
CREATE POLICY sms_ingest_tokens_select_own ON public.sms_ingest_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sms_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sender text,
  body text NOT NULL,
  body_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  parsed jsonb NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done', 'ignored')),
  transaction_id uuid REFERENCES public.transactions (id) ON DELETE SET NULL,
  wallet_id uuid REFERENCES public.wallets (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, body_hash)
);

CREATE INDEX IF NOT EXISTS sms_inbox_user_status_idx ON public.sms_inbox (user_id, status, received_at DESC);

ALTER TABLE public.sms_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sms_inbox_select_own ON public.sms_inbox;
CREATE POLICY sms_inbox_select_own ON public.sms_inbox FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS sms_inbox_update_own ON public.sms_inbox;
CREATE POLICY sms_inbox_update_own ON public.sms_inbox FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS sms_inbox_delete_own ON public.sms_inbox;
CREATE POLICY sms_inbox_delete_own ON public.sms_inbox FOR DELETE USING (auth.uid() = user_id);
-- Inserts come only from the server (service role) after the token check.
