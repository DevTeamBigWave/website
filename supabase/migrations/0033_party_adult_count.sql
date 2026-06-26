-- Party adult headcount
--
-- New policy: each party package now includes 2 adults per kid, with any
-- adult above the included count charged at $10. The included number scales
-- with the kid headcount (a 20-kid Private party comes with 40 free adults).
--
-- This column stores the customer's reported adult count at checkout so the
-- server can recompute the same extra-adult charge that was shown in /book.
-- Pre-existing rows are backfilled to 0 — calculatePartyPricing treats 0 as
-- "uncounted" and produces no extra-adult charge, so legacy invoices and
-- their stored totals are not retroactively impacted.

alter table parties
  add column if not exists adult_count integer not null default 0;

comment on column parties.adult_count is
  'Reported number of adults attending. Each kid in headcount includes 2 free adults; extras at $10/adult are billed via calculatePartyPricing.';
