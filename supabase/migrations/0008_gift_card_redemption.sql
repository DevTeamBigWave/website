-- ============================================================================
-- Allow parties and open_play to carry a gift-card credit so we can show it on
-- the booking and let admin reconcile. Both columns are optional.
--
-- The authoritative redemption record is gift_card_redemptions (created in
-- 0007). These columns are denormalized for fast display in admin without a
-- join.
-- ============================================================================

alter table parties
  add column if not exists gift_card_id uuid references gift_cards(id) on delete set null,
  add column if not exists gift_card_applied_cents int;

alter table open_play
  add column if not exists gift_card_id uuid references gift_cards(id) on delete set null,
  add column if not exists gift_card_applied_cents int;

create index if not exists parties_gift_card_id_idx on parties(gift_card_id);
create index if not exists open_play_gift_card_id_idx on open_play(gift_card_id);
