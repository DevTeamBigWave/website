-- ============================================================================
-- Balance-due nudge sequence: track when we've sent the 3-day deadline
-- reminder and the 24h overdue reminder so the cron stays idempotent
-- (mirrors the existing reminder_24h_sent_at column for the generic
-- 24h-before-party reminder).
-- ============================================================================

alter table parties
  add column if not exists balance_due_reminder_sent_at timestamptz,
  add column if not exists balance_overdue_reminder_sent_at timestamptz;
