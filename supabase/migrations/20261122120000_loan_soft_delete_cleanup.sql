-- A deleted loan (soft delete: deleted_at set) must not leave open installments.
-- The loans page hid the loan, but its unpaid installments still showed in the
-- plan timeline, on home and in the due-soon badge.
--
-- Unpaid installments with no payment at all are removed. Paid and partly paid
-- installments stay: they link to real transactions (paid_transaction_id).

CREATE OR REPLACE FUNCTION public.loans_delete_open_installments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.loan_installments
  WHERE loan_id = NEW.id
    AND is_paid = false
    AND COALESCE(paid_amount, 0) = 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_delete_open_installments ON public.loans;
CREATE TRIGGER trg_loans_delete_open_installments
  AFTER UPDATE OF deleted_at ON public.loans
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.loans_delete_open_installments();

-- One-time cleanup: open installments left by loans deleted before this fix.
DELETE FROM public.loan_installments i
USING public.loans l
WHERE l.id = i.loan_id
  AND l.deleted_at IS NOT NULL
  AND i.is_paid = false
  AND COALESCE(i.paid_amount, 0) = 0;
