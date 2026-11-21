-- Guarantee cheques (چک ضمانت): given as security, not as a payment.
-- They are never a due payment: not in the plan, totals, reminders or settle.
ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS is_guarantee boolean NOT NULL DEFAULT false;
