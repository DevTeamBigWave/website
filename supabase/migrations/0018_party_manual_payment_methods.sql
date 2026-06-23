-- ============================================================================
-- Manual payment recording for parties paid outside Stripe
--
-- When a customer pays via Zelle, cash, or in-person on Clover, the Stripe
-- webhook never fires. Owner needs to mark those payments in admin so
-- deposit_paid_at / balance_paid_amount_cents reflect reality, the calendar
-- event fires, and the open Stripe invoice gets voided.
--
-- payment_method is one of 'card' (Stripe), 'zelle', 'cash', 'clover'.
-- balance_payment_method may accumulate if balance is paid in pieces via
-- different methods — stored as a comma-separated list.
-- ============================================================================

alter table parties
  add column if not exists deposit_payment_method text,
  add column if not exists balance_payment_method text;
