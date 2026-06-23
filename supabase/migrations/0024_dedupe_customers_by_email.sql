-- ============================================================================
-- Customer dedup: same parent showing up multiple times in the dashboard.
--
-- Root cause: customers.email is unique but case-sensitive, and various
-- booking paths pass through raw `body.email` (mixed case, stray whitespace).
-- A second booking from "Gabrielle@Gmail.com" creates a brand-new customer
-- row instead of resolving to the existing "gabrielle@gmail.com" record,
-- so the dashboard "Recently active customers" panel shows duplicates.
--
-- This migration:
--   1. Merges all duplicate customers (by lower-trimmed email): picks the
--      oldest row as the winner, repoints parties / open_play / children /
--      marketing rows to it, dedups children by case-insensitive name,
--      then deletes the losers.
--   2. Normalizes every customer.email to lower(btrim(...)).
--   3. Adds a CHECK constraint so future inserts can't reintroduce dupes
--      via casing alone — anything not pre-normalized errors out loudly.
--   4. Recomputes lifetime stats for the survivors so totals reflect all
--      parties + open-play visits that were previously split across dupes.
-- ============================================================================

-- Step 1: merge duplicates. For each group of customers that share a
-- normalized email, the oldest (first_booking_at, then created_at) wins
-- and everything else gets repointed and deleted.
do $merge$
declare
  grp record;
  winner_id uuid;
  loser_id uuid;
begin
  for grp in
    select lower(btrim(email)) as norm_email,
           array_agg(id order by first_booking_at nulls last, created_at) as ids
      from customers
     group by lower(btrim(email))
    having count(*) > 1
  loop
    winner_id := grp.ids[1];

    foreach loser_id in array grp.ids[2:array_length(grp.ids, 1)]
    loop
      -- Bookings: just repoint
      update parties   set customer_id = winner_id where customer_id = loser_id;
      update open_play set customer_id = winner_id where customer_id = loser_id;

      -- Children: repoint, then drop loser-side rows whose name already
      -- exists on the winner (case-insensitive) so we don't end up with
      -- "Sophie" and "sophie" sitting side by side.
      update children set customer_id = winner_id
       where customer_id = loser_id
         and lower(btrim(name)) not in (
           select lower(btrim(name)) from children where customer_id = winner_id
         );
      delete from children where customer_id = loser_id;

      -- Marketing history: keep the log lines, just repoint
      update marketing_sends        set customer_id = winner_id where customer_id = loser_id;
      update marketing_unsubscribes set customer_id = winner_id where customer_id = loser_id;

      delete from customers where id = loser_id;
    end loop;
  end loop;
end
$merge$;

-- Step 2: normalize every remaining email in place
update customers
   set email = lower(btrim(email))
 where email is distinct from lower(btrim(email));

-- Step 3: forbid unnormalized values going forward
alter table customers
  drop constraint if exists customers_email_normalized;
alter table customers
  add constraint customers_email_normalized
  check (email = lower(btrim(email)));

-- Step 4: recompute lifetime stats for everyone (the merge could have
-- consolidated counts from multiple dupes into a single survivor)
update customers c set
  total_parties = (
    select count(*) from parties
     where customer_id = c.id and status = 'confirmed'
  ),
  total_open_play_visits = (
    select count(*) from open_play
     where customer_id = c.id
       and status in ('paid', 'reserved', 'redeemed')
  ),
  lifetime_value_cents = coalesce((
    select sum(total_cents) from parties
     where customer_id = c.id and status = 'confirmed'
  ), 0) + coalesce((
    select sum(total_cents) from open_play
     where customer_id = c.id and status in ('paid', 'redeemed')
  ), 0),
  first_booking_at = least(
    (select min(created_at) from parties
      where customer_id = c.id and status = 'confirmed'),
    (select min(created_at) from open_play
      where customer_id = c.id and status in ('paid', 'reserved', 'redeemed'))
  ),
  last_booking_at = greatest(
    (select max(created_at) from parties
      where customer_id = c.id and status = 'confirmed'),
    (select max(created_at) from open_play
      where customer_id = c.id and status in ('paid', 'reserved', 'redeemed'))
  );
