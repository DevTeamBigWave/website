-- ============================================================================
-- The blocked_dates trigger previously only fired on parties.status changes.
-- Reschedule (and any future code that changes a party's date / start_time
-- / duration / extension / package without touching status) silently left
-- the old block row in place — the original slot stayed blocked and the
-- new slot stayed bookable. Race-condition heaven.
--
-- This migration replaces the trigger so it fires on every column the
-- trigger function actually reads. The function body is the same as 0027.
-- ============================================================================

drop trigger if exists party_status_change on parties;

create trigger party_status_change
  after insert or update of
    status, date, start_time, duration_minutes, extension_minutes, package
  on parties
  for each row
  execute function sync_blocked_dates_from_party();
