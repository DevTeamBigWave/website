-- ============================================================================
-- Party reminders: track when 7-day and 24-hour reminder emails were sent
-- so the daily cron is idempotent (each party gets one of each, not duplicates)
-- ============================================================================

alter table parties add column reminder_7d_sent_at timestamptz;
alter table parties add column reminder_24h_sent_at timestamptz;

-- Index for the cron's daily lookup: confirmed parties on a specific date
-- where the reminder column is null. Partial indexes keep this fast.
create index parties_reminder_7d_pending_idx on parties(date)
  where status = 'confirmed' and reminder_7d_sent_at is null;

create index parties_reminder_24h_pending_idx on parties(date)
  where status = 'confirmed' and reminder_24h_sent_at is null;
