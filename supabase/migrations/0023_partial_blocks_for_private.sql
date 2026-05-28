-- ============================================================================
-- Private parties no longer block the entire day. They get a 'partial' block
-- the same way Semi-Private parties do, so multiple parties (including back-
-- to-back Privates) can run on the same date as long as their time windows
-- don't conflict.
--
-- Conflict detection moves entirely into the booking flow's time-overlap
-- check, which now also enforces a 30-minute buffer between parties for
-- setup and cleanup.
--
-- Note on the to_jsonb(NEW) dance: the Supabase web SQL editor (especially
-- on mobile) rewrites bare `new.<col>` tokens as `<new.col>` placeholders
-- and breaks parsing. Extracting fields via to_jsonb avoids every dotted
-- record reference so the function body pastes cleanly anywhere.
-- ============================================================================

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
begin
  delete from blocked_dates where party_id = pid;

  if pstatus = 'confirmed' and (ppackage = 'private' or ppackage = 'semi') then
    insert into blocked_dates (date, reason, source, party_id, block_type)
    values (
      pdate,
      case when ppackage = 'private' then 'Private party booked' else 'Semi-private party scheduled' end,
      'party',
      pid,
      'partial'
    );
  end if;

  return new;
end;
$func$;

-- Backfill: any currently-full Private block becomes partial.
update blocked_dates
   set block_type = 'partial'
 where source = 'party'
   and block_type = 'full'
   and party_id in (
     select id from parties where package = 'private' and status = 'confirmed'
   );
