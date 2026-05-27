-- ============================================================================
-- Private parties no longer block the entire day. They get a 'partial' block
-- the same way Semi-Private parties do, so multiple parties (including back-
-- to-back Privates) can run on the same date as long as their time windows
-- don't conflict.
--
-- Conflict detection moves entirely into the booking flow's time-overlap
-- check, which now also enforces a 30-minute buffer between parties for
-- setup and cleanup.
-- ============================================================================

create or replace function sync_blocked_dates_from_party()
returns trigger as $func$
begin
  -- Remove any existing block for this party (handles status changes)
  delete from blocked_dates where party_id = new.id;

  -- Both packages now write a 'partial' block carrying the party's id so the
  -- booking flow can do time-aware overlap checks. Whole-day 'full' blocks
  -- are reserved for admin-created closures (plumbing, holidays, etc).
  if new.status = 'confirmed' and (new.package = 'private' or new.package = 'semi') then
    insert into blocked_dates (date, reason, source, party_id, block_type)
    values (
      new.date,
      case
        when new.package = 'private' then 'Private party booked'
        else 'Semi-private party scheduled'
      end,
      'party',
      new.id,
      'partial'
    );
  end if;

  return new;
end;
$func$ language plpgsql;

-- Backfill: any currently-full Private block becomes partial.
update blocked_dates
   set block_type = 'partial'
 where source = 'party'
   and block_type = 'full'
   and party_id in (
     select id from parties where package = 'private' and status = 'confirmed'
   );
