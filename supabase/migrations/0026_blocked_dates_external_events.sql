-- ============================================================================
-- Manual Google Calendar parties show up in blocked_dates too.
--
-- The cron at /api/cron/sync-calendar-parties pulls events from the owner's
-- Google Calendar, filters for any that look like a private or semi-private
-- party (case-insensitive match on "private" or "semi" in the title), and
-- writes a blocked_dates row for each one that isn't already backed by a
-- parties row in our DB. This catches:
--   - Pre-website parties that only live on the calendar
--   - One-off manual entries the owner types directly into Calendar
--
-- For these blocks there's no parties row to JOIN to, so we need start_time
-- and duration_minutes ON the blocked_dates row itself. external_event_id is
-- how the cron reconciles (upsert by id; delete blocks whose id no longer
-- exists in the calendar).
--
-- The trigger that syncs blocked_dates from parties is also updated to
-- populate start_time + duration_minutes inline, so the availability API
-- can stop relying on a join for time-overlap math.
-- ============================================================================

alter table blocked_dates
  add column if not exists start_time time,
  add column if not exists duration_minutes int,
  add column if not exists external_event_id text;

create unique index if not exists blocked_dates_external_event_idx
  on blocked_dates(external_event_id)
  where external_event_id is not null;

-- Backfill: pull start_time + duration into blocked_dates rows that came
-- from a parties row, so the API can read them without a JOIN.
update blocked_dates
   set start_time = parties.start_time,
       duration_minutes = coalesce(parties.duration_minutes, 120)
                          + coalesce(parties.extension_minutes, 0)
  from parties
 where blocked_dates.party_id = parties.id
   and blocked_dates.start_time is null;

-- Updated trigger: also write start_time + duration_minutes into the block
-- row, so external + internal blocks have the same shape and the
-- availability endpoint never needs a JOIN.
create or replace function sync_blocked_dates_from_party()
returns trigger
language plpgsql
as $func$
declare
  r jsonb := to_jsonb(new);
  pid uuid := (r->>'id')::uuid;
  pstatus text := r->>'status';
  ppackage text := r->>'package';
  pdate date := (r->>'date')::date;
  pstart time := (r->>'start_time')::time;
  pdur int := coalesce((r->>'duration_minutes')::int, 120)
              + coalesce((r->>'extension_minutes')::int, 0);
begin
  delete from blocked_dates where party_id = pid;

  if pstatus in ('hold', 'confirmed')
     and (ppackage = 'private' or ppackage = 'semi') then
    insert into blocked_dates
      (date, reason, source, party_id, block_type, start_time, duration_minutes)
    values (
      pdate,
      case when ppackage = 'private' then 'Private party booked' else 'Semi-private party scheduled' end,
      'party',
      pid,
      'partial',
      pstart,
      pdur
    );
  end if;

  return new;
end;
$func$;
