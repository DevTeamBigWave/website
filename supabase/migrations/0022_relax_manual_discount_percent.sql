-- ============================================================================
-- Allow arbitrary 0-100 % friends-&-family discount (was restricted to
-- 0/10/15/20). Custom-% input on the discount picker needs this.
-- ============================================================================

alter table parties drop constraint if exists parties_manual_discount_percent_check;
alter table parties add constraint parties_manual_discount_percent_check
  check (manual_discount_percent >= 0 and manual_discount_percent <= 100);
