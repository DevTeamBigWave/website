-- ============================================================================
-- Any party card on the books = that slot is blocked. Whether the party is
-- still in 'hold' during checkout, fully 'confirmed' with a deposit, or
-- confirmed via a promo code that bypassed the deposit — the time window
-- gets reserved the moment the card exists. The trigger previously only
-- wrote blocks for 'confirmed' parties, which left a gap during checkout
-- (race conditions) and meant manual mark-paid + admin-created parties had
-- to wait on status changes before locking the slot.
--
-- Cancelled parties drop their block (the trigger deletes the row first,
-- then the IF gate skips the re-insert), so reschedules and cancellations
-- still free the slot up properly.
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

  if pstatus in ('hold', 'confirmed')
     and (ppackage = 'private' or ppackage = 'semi') then
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

-- Backfill: any future-dated hold party that doesn't already have a block
-- row should get one. (Old abandoned holds for past dates we ignore — no
-- point blocking dates that have already gone by.)
insert into blocked_dates (date, reason, source, party_id, block_type)
select parties.date,
       case when parties.package = 'private'
              then 'Private party booked'
              else 'Semi-private party scheduled' end,
       'party',
       parties.id,
       'partial'
  from parties
 where parties.status = 'hold'
   and parties.date >= current_date
   and (parties.package = 'private' or parties.package = 'semi')
   and parties.id not in (
     select party_id from blocked_dates where party_id is not null
   );
