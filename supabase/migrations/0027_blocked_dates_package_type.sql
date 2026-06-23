-- ============================================================================
-- Semi-private parties don't actually pause open play — only the party room
-- is dedicated, the rest of the venue stays open to drop-ins. But the
-- blocked_dates trigger writes a row for semi-private parties too (so the
-- /book conflict check still works: only one semi runs per day). That row
-- was bleeding through to the open-play page and showing a "paused"
-- banner where there shouldn't be one.
--
-- This migration adds a package_type column so the availability API can
-- differentiate, and the open-play page can ignore semi-private blocks
-- when rendering the closure banner / coral tile tint. The booking flow
-- still respects both types for its time-conflict math.
-- ============================================================================

alter table blocked_dates
  add column if not exists package_type text;

-- Backfill from existing reason text (the trigger wrote these strings)
update blocked_dates
   set package_type = 'private'
 where source = 'party'
   and package_type is null
   and reason like 'Private%';

update blocked_dates
   set package_type = 'semi'
 where source = 'party'
   and package_type is null
   and reason like 'Semi%';

-- Updated trigger: also writes package_type
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
      (date, reason, source, party_id, block_type,
       start_time, duration_minutes, package_type)
    values (
      pdate,
      case when ppackage = 'private' then 'Private party booked' else 'Semi-private party scheduled' end,
      'party',
      pid,
      'partial',
      pstart,
      pdur,
      ppackage
    );
  end if;

  return new;
end;
$func$;
