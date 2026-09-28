-- Security fix: these SECURITY DEFINER aggregates take `p_user_id` as a
-- parameter and bypass RLS. Granted to `authenticated`, any signed-in user
-- could read another user's totals by passing a different id.
-- The app calls them only from the server with the service-role client,
-- so we remove access for `authenticated` and keep `service_role`.

REVOKE EXECUTE ON FUNCTION public.get_today_expense_total_toman(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_period_cashflow_toman(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_category_expense_toman_for_period(uuid, uuid, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_today_expense_total_toman(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_period_cashflow_toman(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_category_expense_toman_for_period(uuid, uuid, text, text) TO service_role;
