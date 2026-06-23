-- ============================================================================
-- Memberships: $150/mo recurring, one child per membership.
--
-- One row per active subscription. Lifecycle managed by Stripe webhooks.
-- Auto-blocks during private parties via blocked_dates (members read same
-- closure logic as open play visitors).
-- ============================================================================

create table memberships (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  child_id uuid references children(id) on delete set null,

  -- Cached identity (in case customers/children rows are later edited)
  parent_name text not null,
  email text not null,
  phone text not null,
  child_name text not null,
  child_dob date,

  -- Stripe trail
  stripe_customer_id text not null,
  stripe_subscription_id text unique not null,
  stripe_price_id text,

  -- Lifecycle
  status text not null default 'incomplete' check (
    status in ('incomplete', 'active', 'past_due', 'paused', 'canceled')
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  canceled_at timestamptz,
  ended_at timestamptz,

  started_at timestamptz,
  amount_cents int not null default 15000,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index memberships_email_idx on memberships(email);
create index memberships_status_idx on memberships(status);
create index memberships_stripe_sub_idx on memberships(stripe_subscription_id);
create index memberships_period_end_idx on memberships(current_period_end);

create trigger memberships_updated_at before update on memberships
  for each row execute function set_updated_at();

alter table memberships enable row level security;
create policy memberships_service_role on memberships for all
  using (auth.role() = 'service_role');
