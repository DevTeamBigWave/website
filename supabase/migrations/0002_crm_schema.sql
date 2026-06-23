-- ============================================================================
-- Wonderland Playhouse — CRM Schema
--
-- Adds:
--   customers       — deduped by email; aggregates lifetime stats
--   children        — one row per kid with DOB for birthday automation
--   marketing_sends — append-only log of automated emails sent
--   marketing_unsubscribes — opt-out list, keyed by email
--   admin_users     — multi-staff allowlist for the admin portal
--
-- Extends:
--   parties     — adds customer_id FK + child_dob
--   open_play   — adds customer_id FK
--
-- Triggers backfill customer + children records automatically on every
-- confirmed booking (parties) and reserved/paid visit (open_play).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- customers: deduped parent records
-- ----------------------------------------------------------------------------
create table customers (
  id uuid primary key default uuid_generate_v4(),

  -- Identity
  email text unique not null,
  parent_name text not null,
  phone text,

  -- Provenance: where did we first see this customer?
  -- 'organic' = direct booking on our site
  -- 'wix_import' = backfilled from Wix list
  -- 'manual' = staff-entered via admin
  source text default 'organic' check (source in ('organic', 'wix_import', 'manual')),

  -- Lifetime stats (kept current by triggers on parties / open_play)
  total_parties int default 0,
  total_open_play_visits int default 0,
  lifetime_value_cents int default 0,
  first_booking_at timestamptz,
  last_booking_at timestamptz,

  -- Marketing
  -- subscribed_to_marketing is the top-level toggle. Unsubscribes go in
  -- marketing_unsubscribes for granular scopes (birthday-only vs all).
  subscribed_to_marketing boolean default true,

  -- Staff notes (private, never sent to customers)
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index customers_email_idx on customers(email);
create index customers_last_booking_idx on customers(last_booking_at desc nulls last);

-- ----------------------------------------------------------------------------
-- children: kids associated with a customer
-- ----------------------------------------------------------------------------
create table children (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,

  name text not null,
  date_of_birth date,

  -- Free-text notes: allergies, preferences, etc.
  notes text,

  -- Per-child unsubscribe (in case parent has 2 kids and wants reminders for one only)
  birthday_emails_subscribed boolean default true,
  last_birthday_reminder_sent_at timestamptz,
  last_birthday_reminder_campaign text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Cron index: find kids whose birthday is N weeks out and still subscribed
create index children_dob_active_idx on children(date_of_birth)
  where date_of_birth is not null and birthday_emails_subscribed = true;
create index children_customer_idx on children(customer_id);

-- ----------------------------------------------------------------------------
-- Extend parties and open_play with customer_id FKs and DOB
-- ----------------------------------------------------------------------------
alter table parties add column customer_id uuid references customers(id);
alter table parties add column child_dob date;

alter table open_play add column customer_id uuid references customers(id);

create index parties_customer_idx on parties(customer_id);
create index open_play_customer_idx on open_play(customer_id);

-- ----------------------------------------------------------------------------
-- marketing_sends: log of every automated email we send
-- Used for: deduping, debugging, suppression, open-rate analytics later
-- ----------------------------------------------------------------------------
create table marketing_sends (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  child_id uuid references children(id) on delete set null,

  -- Campaign categorization
  -- 'birthday_12w' / 'birthday_8w' / 'birthday_4w' = birthday automation touchpoints
  -- 'special_event' = holiday/seasonal campaign
  -- 'promotion' = ad-hoc promo blast
  -- 'transactional' = booking confirmations, not marketing (CAN-SPAM exempt)
  campaign_type text not null check (campaign_type in (
    'birthday_12w', 'birthday_8w', 'birthday_4w',
    'special_event', 'promotion', 'transactional'
  )),
  campaign_id text,

  -- The actual email
  subject text not null,
  to_email text not null,

  -- Delivery state
  status text default 'queued' check (status in (
    'queued', 'sent', 'failed', 'bounced', 'suppressed'
  )),
  sent_at timestamptz,
  resend_message_id text,
  error_message text,

  created_at timestamptz default now()
);

create index marketing_sends_customer_idx on marketing_sends(customer_id);
create index marketing_sends_child_campaign_idx on marketing_sends(child_id, campaign_type);
create index marketing_sends_status_idx on marketing_sends(status, created_at);

-- ----------------------------------------------------------------------------
-- marketing_unsubscribes: cheap lookup before any send
-- ----------------------------------------------------------------------------
create table marketing_unsubscribes (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  customer_id uuid references customers(id) on delete cascade,

  -- 'all' suppresses everything; granular scopes let parents opt out
  -- of just birthday reminders OR just promos but keep the others.
  scope text default 'all' check (scope in (
    'all', 'birthday_reminders', 'promotions', 'special_events'
  )),
  reason text,

  -- Optional: one-time-use token for the unsubscribe link
  unsubscribe_token text,

  created_at timestamptz default now()
);

create unique index marketing_unsubscribes_email_scope_idx
  on marketing_unsubscribes(email, scope);
create index marketing_unsubscribes_email_idx on marketing_unsubscribes(email);

-- ----------------------------------------------------------------------------
-- admin_users: who can sign into /admin
-- ----------------------------------------------------------------------------
create table admin_users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,

  -- 'owner' = full access
  -- 'staff' = full access to bookings/customers, no destructive ops
  -- 'readonly' = view-only (eg accountant)
  role text default 'staff' check (role in ('owner', 'staff', 'readonly')),

  display_name text,
  active boolean default true,
  last_signed_in_at timestamptz,
  created_at timestamptz default now()
);

-- Seed the owner. Update this row if the email changes.
insert into admin_users (email, role, display_name, active)
values ('info@wonderlandplayhouse.com', 'owner', 'Wonderland Playhouse', true);

-- ----------------------------------------------------------------------------
-- updated_at maintenance for new tables
-- ----------------------------------------------------------------------------
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger children_updated_at before update on children
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- TRIGGER: sync_customer_from_party
-- When a party is confirmed, upsert the parent into customers, link the
-- party, upsert the child into children, and recompute the customer's
-- lifetime stats. Idempotent: re-running on an already-confirmed party
-- is a no-op (gated by the status transition check).
-- ----------------------------------------------------------------------------
create or replace function sync_customer_from_party()
returns trigger as $$
declare
  v_customer_id uuid;
  v_child_id uuid;
begin
  -- Only fire on the transition INTO confirmed
  if not (new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed')) then
    return new;
  end if;

  -- Upsert parent
  insert into customers (email, parent_name, phone, source, first_booking_at, last_booking_at)
  values (new.email, new.parent_name, new.phone, 'organic', now(), now())
  on conflict (email) do update set
    parent_name = coalesce(excluded.parent_name, customers.parent_name),
    phone = coalesce(excluded.phone, customers.phone),
    last_booking_at = now(),
    updated_at = now()
  returning id into v_customer_id;

  -- Link party to customer
  update parties set customer_id = v_customer_id where id = new.id;

  -- Upsert child (case-insensitive name match within this customer)
  if new.child_name is not null and length(trim(new.child_name)) > 0 then
    select id into v_child_id from children
      where customer_id = v_customer_id
        and lower(name) = lower(trim(new.child_name))
      limit 1;

    if v_child_id is null then
      insert into children (customer_id, name, date_of_birth)
      values (v_customer_id, trim(new.child_name), new.child_dob)
      returning id into v_child_id;
    elsif new.child_dob is not null then
      -- Backfill DOB on existing child record if we now have it
      update children
         set date_of_birth = coalesce(new.child_dob, date_of_birth),
             updated_at = now()
       where id = v_child_id;
    end if;
  end if;

  -- Recompute lifetime stats
  update customers set
    total_parties = (
      select count(*) from parties
       where customer_id = v_customer_id and status = 'confirmed'
    ),
    lifetime_value_cents = (
      select coalesce(sum(total_cents), 0)
        from parties
       where customer_id = v_customer_id and status = 'confirmed'
    ) + (
      select coalesce(sum(total_cents), 0)
        from open_play
       where customer_id = v_customer_id and status in ('paid', 'redeemed')
    )
  where id = v_customer_id;

  return new;
end;
$$ language plpgsql;

create trigger party_sync_customer
  after insert or update of status on parties
  for each row
  execute function sync_customer_from_party();

-- ----------------------------------------------------------------------------
-- TRIGGER: sync_customer_from_open_play
-- Same idea but for open play. Open play doesn't capture child names
-- yet, so we only populate the customer record (no child records).
-- ----------------------------------------------------------------------------
create or replace function sync_customer_from_open_play()
returns trigger as $$
declare
  v_customer_id uuid;
begin
  if not (new.status in ('paid', 'reserved') and (tg_op = 'INSERT' or old.status is distinct from new.status)) then
    return new;
  end if;

  insert into customers (email, parent_name, phone, source, first_booking_at, last_booking_at)
  values (new.email, new.parent_name, new.phone, 'organic', now(), now())
  on conflict (email) do update set
    parent_name = coalesce(excluded.parent_name, customers.parent_name),
    phone = coalesce(excluded.phone, customers.phone),
    last_booking_at = now(),
    updated_at = now()
  returning id into v_customer_id;

  update open_play set customer_id = v_customer_id where id = new.id;

  update customers set
    total_open_play_visits = (
      select count(*) from open_play
       where customer_id = v_customer_id
         and status in ('paid', 'reserved', 'redeemed')
    ),
    lifetime_value_cents = (
      select coalesce(sum(total_cents), 0)
        from parties
       where customer_id = v_customer_id and status = 'confirmed'
    ) + (
      select coalesce(sum(total_cents), 0)
        from open_play
       where customer_id = v_customer_id and status in ('paid', 'redeemed')
    )
  where id = v_customer_id;

  return new;
end;
$$ language plpgsql;

create trigger open_play_sync_customer
  after insert or update of status on open_play
  for each row
  execute function sync_customer_from_open_play();

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- All CRM tables are service-role-only — the admin portal uses
-- supabaseAdmin() (service key, bypasses RLS) and the unsubscribe endpoint
-- runs server-side with its own validation. No public access to PII.
-- ----------------------------------------------------------------------------
alter table customers enable row level security;
alter table children enable row level security;
alter table marketing_sends enable row level security;
alter table marketing_unsubscribes enable row level security;
alter table admin_users enable row level security;

create policy customers_service_role on customers for all
  using (auth.role() = 'service_role');
create policy children_service_role on children for all
  using (auth.role() = 'service_role');
create policy marketing_sends_service_role on marketing_sends for all
  using (auth.role() = 'service_role');
create policy marketing_unsubscribes_service_role on marketing_unsubscribes for all
  using (auth.role() = 'service_role');
create policy admin_users_service_role on admin_users for all
  using (auth.role() = 'service_role');
