-- Label promo codes with a human-readable purpose. The skip-deposit codes
-- previously only had auto-generated SKIP-XXXX-XXXX with no context, so an
-- owner glancing at the history table couldn't tell which one was for
-- "influencer Sarah" vs "repeat customer Mike" vs the monthly auto-rotated
-- public code. Optional — null falls back to the kind name in display.

alter table promo_codes
  add column if not exists label text;

-- We'll also use this column to tag the auto-generated monthly code so it
-- shows up as "Monthly skip-deposit" in the marketing email's promo picker
-- rather than just SKIP-XXXX-XXXX. Backfill the most recent active row.
update promo_codes
   set label = 'Monthly skip-deposit'
 where label is null
   and rotation_origin = 'monthly_cron';
