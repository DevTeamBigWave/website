-- ============================================================================
-- Gift cards: purchasable via Stripe, redeemable at party + open-play checkout
--
-- Each purchase creates a gift_cards row (status='pending' until Stripe webhook
-- flips to 'active'). The recipient gets emailed a unique code. At redemption,
-- the code is validated and amount applied as a discount; partial redemptions
-- are tracked via redeemed_cents so a $100 card can cover a $25 visit and
-- leave $75 on the card.
-- ============================================================================

create table gift_cards (
  id uuid primary key default uuid_generate_v4(),

  -- Customer-facing code (e.g. "WP-7K2M-9XQR"). Unique, uppercase, 12 chars.
  code text unique not null,

  -- Original value purchased
  amount_cents int not null check (amount_cents > 0),

  -- Sum of all redemptions so far. balance = amount_cents - redeemed_cents.
  redeemed_cents int not null default 0 check (redeemed_cents >= 0),

  -- Purchaser
  purchaser_name text not null,
  purchaser_email text not null,

  -- Recipient (the kid's parent who'll redeem)
  recipient_name text not null,
  recipient_email text not null,

  -- Optional personal message shown in the recipient email
  message text,

  -- Status:
  --   pending  — Stripe session created, payment not confirmed yet
  --   active   — paid, code emailed to recipient, redeemable
  --   redeemed — fully spent (redeemed_cents = amount_cents)
  --   void     — refunded or admin-cancelled
  status text not null default 'pending' check (
    status in ('pending', 'active', 'redeemed', 'void')
  ),

  -- Stripe trail
  stripe_session_id text,
  stripe_payment_intent text,

  -- Lifecycle timestamps
  paid_at timestamptz,
  recipient_emailed_at timestamptz,
  voided_at timestamptz,
  void_reason text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index gift_cards_code_idx on gift_cards(code);
create index gift_cards_status_idx on gift_cards(status);
create index gift_cards_purchaser_email_idx on gift_cards(purchaser_email);
create index gift_cards_recipient_email_idx on gift_cards(recipient_email);

create trigger gift_cards_updated_at before update on gift_cards
  for each row execute function set_updated_at();

-- Per-redemption audit log so we can see exactly where each card was spent
create table gift_card_redemptions (
  id uuid primary key default uuid_generate_v4(),
  gift_card_id uuid not null references gift_cards(id) on delete restrict,

  -- What was paid for. Exactly one of these will be set.
  party_id uuid references parties(id) on delete set null,
  open_play_id uuid references open_play(id) on delete set null,

  amount_cents int not null check (amount_cents > 0),
  redeemed_at timestamptz default now(),

  -- The Stripe session this redemption was applied to (for cross-reference)
  stripe_session_id text
);

create index gift_card_redemptions_card_idx on gift_card_redemptions(gift_card_id);
create index gift_card_redemptions_party_idx on gift_card_redemptions(party_id);
create index gift_card_redemptions_open_play_idx on gift_card_redemptions(open_play_id);

alter table gift_cards enable row level security;
alter table gift_card_redemptions enable row level security;

create policy gift_cards_service_role on gift_cards for all
  using (auth.role() = 'service_role');
create policy gift_card_redemptions_service_role on gift_card_redemptions for all
  using (auth.role() = 'service_role');
