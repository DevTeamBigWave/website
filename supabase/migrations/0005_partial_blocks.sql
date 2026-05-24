-- ============================================================================
-- Switch private-party blocks from 'full' (whole day) to 'partial' (time window)
--
-- Old behavior: private party on a day = open play closed all day
-- New behavior: private party on a day = open play closed only during the
--               party window (start_time → start_time + duration + extension).
--               Open play remains bookable for that date — the booking flow
--               shows the closure window so customers can arrive outside it.
--
-- Booking conflict detection for OTHER parties already uses time-overlap
-- (added in app/api/checkout/party/route.ts), so this change doesn't loosen
-- party-vs-party conflict rules.
-- ============================================================================

create or replace function sync_blocked_dates_from_party()
returns trigger as $$
begin
  delete from blocked_dates where party_id = new.id;

  -- Both private and semi-private create partial blocks. Open play is still
  -- available — the booking flow shows the closure window per date.
  if (new.package = 'private' or new.package = 'semi') and new.status = 'confirmed' then
    insert into blocked_dates (date, reason, source, party_id, block_type)
    values (
      new.date,
      case when new.package = 'private'
        then 'Private party booked during this window'
        else 'Semi-private party scheduled during this window'
      end,
      'party',
      new.id,
      'partial'
    );
  end if;

  return new;
end;
$$ language plpgsql;

-- Backfill existing blocked_dates rows: any existing 'full' party block
-- becomes 'partial' so the booking flow stops killing those whole days.
update blocked_dates
   set block_type = 'partial'
 where source = 'party' and block_type = 'full';
