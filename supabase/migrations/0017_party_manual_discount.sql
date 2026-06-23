-- ============================================================================
-- Manual "friends & family" discount
--
-- Separate from the auto Mon–Thu private-party 20% off (which lives in
-- parties.discount_cents). This is an owner-applied courtesy discount —
-- 0 (off) / 10 / 15 / 20 percent of the grand total (party + add-ons,
-- post-tax). Applied as a single credit line on the Stripe invoice.
-- ============================================================================

alter table parties
  add column if not exists manual_discount_percent int not null default 0
    check (manual_discount_percent in (0, 10, 15, 20));
