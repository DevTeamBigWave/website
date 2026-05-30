-- Split each daily_labor row into expected (from "What's Happening Today" on
-- the morning email) and actual (from "Yesterday's Summary" on the next
-- morning's email). Existing total_cost_cents / total_hours / per_employee
-- stay as the "actual" columns; new expected_* columns hold the schedule
-- side. Both can be null until the corresponding email lands.

alter table daily_labor
  add column if not exists expected_cost_cents int,
  add column if not exists expected_hours numeric(8, 2),
  add column if not exists expected_per_employee jsonb;

-- A single Homebase email touches two rows now (today's expected + yesterday's
-- actual), so source_email_id can no longer pretend to be unique per row.
-- The idempotency check in the importer already runs per-row by labor_date.
