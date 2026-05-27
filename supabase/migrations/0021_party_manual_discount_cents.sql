-- ============================================================================
-- Custom-dollar-amount friends & family discount
--
-- Sibling to manual_discount_percent. When > 0, takes precedence over the
-- percent (the discount-picker API zeroes one when the other is set, so they
-- can't both apply at once). Stored as cents.
-- ============================================================================

alter table parties
  add column if not exists manual_discount_cents int not null default 0
    check (manual_discount_cents >= 0);
