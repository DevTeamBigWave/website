-- ============================================================================
-- Wonderland Playhouse — Database Schema
-- Single source of truth for all bookings. Triggers auto-block conflicts.
-- ============================================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- parties: every confirmed/pending party booking
-- ----------------------------------------------------------------------------
create table parties (
  id uuid primary key default uuid_generate_v4(),

  -- Booking essentials
  package text not null check (package in ('private', 'semi')),
  date date not null,
  start_time time not null,
  duration_minutes int not null default 120,
  extension_minutes int default 0,

  -- The party itself
  child_name text not null,
  child_age int,
  headcount int not null,
  notes text,

  -- Parent contact
  parent_name text not null,
  email text not null,
  phone text not null,

  -- Money
  subtotal_cents int not null,
  discount_cents int default 0,
  tax_cents int not null,
  total_cents int not null,
  deposit_cents int not null,
  deposit_paid_at timestamptz,
  balance_paid_at timestamptz,

  -- Stripe
  stripe_deposit_session_id text,
  stripe_deposit_payment_intent text,
  stripe_balance_payment_intent text,

  -- Status flow: hold -> confirmed -> completed | cancelled
  -- 'hold' = call-first path, 48hr soft hold
  -- 'confirmed' = deposit paid, calendar locked
  status text not null default 'hold' check (status in ('hold', 'confirmed', 'completed', 'cancelled')),
  hold_expires_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  -- Discount tracking (for analytics: how often does Mon-Thu special fire?)
  weekday_discount_applied boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index parties_date_idx on parties(date);
create index parties_status_idx on parties(status);
create index parties_email_idx on parties(email);

-- ----------------------------------------------------------------------------
-- open_play: pre-paid open play tickets
-- ----------------------------------------------------------------------------
create table open_play (
  id uuid primary key default uuid_generate_v4(),

  date date not null,
  num_children int not null,

  parent_name text not null,
  email text not null,
  phone text not null,

  total_cents int not null,
  payment_method text check (payment_method in ('online', 'at_door')),

  -- Stripe
  stripe_session_id text,
  stripe_payment_intent text,
  paid_at timestamptz,

  status text not null default 'reserved' check (status in ('reserved', 'paid', 'redeemed', 'cancelled', 'no_show')),
  redeemed_at timestamptz,

  -- QR ticket code emailed to customer
  ticket_code text unique default substring(uuid_generate_v4()::text, 1, 8),

  created_at timestamptz default now()
);

create index open_play_date_idx on open_play(date);
create index open_play_email_idx on open_play(email);

-- ----------------------------------------------------------------------------
-- blocked_dates: derived view of what's unavailable
-- Populated automatically by trigger on parties insert/update
-- ----------------------------------------------------------------------------
create table blocked_dates (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  reason text not null,
  source text not null check (source in ('party', 'manual', 'holiday')),
  -- If derived from a party, link to it for cascade
  party_id uuid references parties(id) on delete cascade,
  -- 'full' = closes open play entirely. 'partial' = info only.
  block_type text not null default 'full' check (block_type in ('full', 'partial')),

  created_at timestamptz default now()
);

create index blocked_dates_date_idx on blocked_dates(date);

-- ----------------------------------------------------------------------------
-- TRIGGER: when a private party becomes 'confirmed', block the date
-- This is THE rule: private party = open play closed. No app code needed.
-- ----------------------------------------------------------------------------
create or replace function sync_blocked_dates_from_party()
returns trigger as $$
begin
  -- Remove any existing block for this party (handles status changes)
  delete from blocked_dates where party_id = new.id;

  -- Private confirmed party = full block
  if new.package = 'private' and new.status = 'confirmed' then
    insert into blocked_dates (date, reason, source, party_id, block_type)
    values (new.date, 'Private party booked', 'party', new.id, 'full');
  end if;

  -- Semi-private confirmed = informational, open play stays open per business rule
  if new.package = 'semi' and new.status = 'confirmed' then
    insert into blocked_dates (date, reason, source, party_id, block_type)
    values (new.date, 'Semi-private party scheduled', 'party', new.id, 'partial');
  end if;

  return new;
end;
$$ language plpgsql;

create trigger party_status_change
  after insert or update of status on parties
  for each row
  execute function sync_blocked_dates_from_party();

-- ----------------------------------------------------------------------------
-- TRIGGER: auto-expire 'hold' bookings after 48 hours
-- Run via pg_cron or a Vercel cron route every hour
-- ----------------------------------------------------------------------------
create or replace function expire_stale_holds()
returns void as $$
begin
  update parties
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'Hold expired (48hr no deposit)'
  where status = 'hold'
    and hold_expires_at < now();
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- VIEW: availability_view — what the booking flow reads
-- Returns one row per blocked date with the reason
-- ----------------------------------------------------------------------------
create or replace view availability_view as
select
  bd.date,
  bd.block_type,
  bd.reason,
  p.package,
  p.start_time,
  p.duration_minutes + coalesce(p.extension_minutes, 0) as total_minutes
from blocked_dates bd
left join parties p on p.id = bd.party_id
where p.status = 'confirmed' or bd.source != 'party';

-- ----------------------------------------------------------------------------
-- updated_at auto-update
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger parties_updated_at before update on parties
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------
alter table parties enable row level security;
alter table open_play enable row level security;
alter table blocked_dates enable row level security;

-- Public can read availability (for the booking calendar)
create policy "blocked_dates readable by all"
  on blocked_dates for select
  using (true);

-- Only service role can insert/update parties (via API routes with service key)
create policy "parties insert via service role only"
  on parties for insert
  with check (auth.role() = 'service_role');

create policy "parties update via service role only"
  on parties for update
  using (auth.role() = 'service_role');

create policy "open_play insert via service role only"
  on open_play for insert
  with check (auth.role() = 'service_role');

-- Customers can look up their own bookings by email + ticket code (future feature)
create policy "open_play self-lookup"
  on open_play for select
  using (true);
