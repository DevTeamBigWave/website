-- Promo code builder schema — adds the fields the new admin builder needs
-- to express percent-off codes scoped to specific products and channels.
--
-- Kept additive: existing skip_deposit rows keep working with their
-- existing columns (max_uses, valid_until, etc). New columns default in a
-- way that mirrors the old behavior (applies_to = all products, channel
-- = both) so legacy codes don't suddenly start failing validation.

-- Extend the kind enum. Drop the old single-value check, add the new one.
alter table promo_codes
  drop constraint if exists promo_codes_kind_check;
alter table promo_codes
  add constraint promo_codes_kind_check
  check (kind in ('skip_deposit', 'percent_off'));

-- Percent off (0-100, only meaningful when kind='percent_off')
alter table promo_codes
  add column if not exists discount_percent int
  check (discount_percent is null or (discount_percent >= 1 and discount_percent <= 100));

-- Which products the code applies to. Stored as text[] so we can index
-- and filter cheaply. Values: 'party', 'open_play', 'membership', 'gift_card'.
-- Null/empty = applies to everything (legacy behavior).
alter table promo_codes
  add column if not exists applies_to text[];

-- Channel restriction: 'online' (customer-entered in booking UI),
-- 'admin' (owner only — entered in /admin/parties or similar),
-- 'both' (either path). Default 'both' to preserve old behavior.
alter table promo_codes
  add column if not exists channel text not null default 'both'
  check (channel in ('online', 'admin', 'both'));

-- Future-proofing: if you want to expire a code without waiting for
-- valid_until, set this. Validation rejects when not null.
alter table promo_codes
  add column if not exists disabled_at timestamptz;

create index if not exists promo_codes_channel_idx on promo_codes(channel);
