-- ============================================================================
-- Appointments: tours, party inquiry calls, post-deposit planning calls
--
-- Each appointment TYPE has its own weekly availability windows. Owner can
-- edit windows per type (e.g. tours Mon-Sat 11-4, inquiry Mon-Fri 1-4,
-- planning Mon-Fri 10-5). Customers see only slots that:
--   1. Fall within the type's weekly windows
--   2. Don't conflict with the owner's Google Calendar (busy times)
--   3. Don't overlap an already-booked appointment of any type
--
-- When a customer books, we create a Google Calendar event in the owner's
-- calendar with the customer as an attendee.
-- ============================================================================

create table appointment_types (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,             -- 'tour' | 'inquiry' | 'planning'
  name text not null,                    -- shown to customers
  description text,
  duration_minutes int not null,
  buffer_minutes int default 0,          -- gap between back-to-back appointments
  -- Visibility: customers can see/book any active type from a /book URL.
  -- 'planning' isn't shown publicly; it's only used via email link post-deposit.
  is_public boolean default true,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Each row = an available window on a single day of the week
-- e.g. (type=tour, day_of_week=1 [Mon], start='11:00', end='16:00')
create table appointment_availability (
  id uuid primary key default uuid_generate_v4(),
  type_id uuid not null references appointment_types(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sun
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  created_at timestamptz default now()
);

create index appointment_availability_type_idx on appointment_availability(type_id, day_of_week);

-- Booked appointments
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  type_id uuid not null references appointment_types(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,

  -- Time
  start_at timestamptz not null,
  end_at timestamptz not null,

  -- Customer contact (cached for convenience; customer_id is the source of truth)
  parent_name text not null,
  email text not null,
  phone text,
  notes text,

  status text not null default 'confirmed' check (
    status in ('confirmed', 'cancelled', 'completed', 'no_show')
  ),
  cancellation_reason text,
  cancelled_at timestamptz,

  -- Google Calendar event for owner's calendar
  google_calendar_event_id text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index appointments_start_at_idx on appointments(start_at);
create index appointments_type_status_idx on appointments(type_id, status);
create index appointments_customer_idx on appointments(customer_id);

create trigger appointment_types_updated_at before update on appointment_types
  for each row execute function set_updated_at();
create trigger appointments_updated_at before update on appointments
  for each row execute function set_updated_at();

-- RLS: service-role only (admin portal + booking endpoints use service key)
alter table appointment_types enable row level security;
alter table appointment_availability enable row level security;
alter table appointments enable row level security;

create policy appointment_types_service_role on appointment_types for all
  using (auth.role() = 'service_role');
create policy appointment_availability_service_role on appointment_availability for all
  using (auth.role() = 'service_role');
create policy appointments_service_role on appointments for all
  using (auth.role() = 'service_role');

-- Seed: three default types with sensible default availability
-- Owner can edit windows later via admin UI (built in a follow-up)
insert into appointment_types (slug, name, description, duration_minutes, is_public)
values
  ('tour', 'Venue Tour',
   'See the venue in person — 30-min walkthrough. Great if you''re considering a party.',
   30, true),
  ('inquiry', 'Party Inquiry Call',
   '20-min phone call to talk through dates, packages, and your vision before booking online.',
   20, true),
  ('planning', 'Party Planning Call',
   '30-min call after your deposit to confirm add-ons, theme, and timeline.',
   30, false);

-- Default windows (all times in America/New_York / venue local time):
--   Tour: Mon-Sat 11am-4pm
--   Inquiry: Mon-Fri 1pm-4pm
--   Planning: Mon-Fri 10am-5pm
do $$
declare t_tour uuid;
        t_inquiry uuid;
        t_planning uuid;
begin
  select id into t_tour from appointment_types where slug = 'tour';
  select id into t_inquiry from appointment_types where slug = 'inquiry';
  select id into t_planning from appointment_types where slug = 'planning';

  -- Tour: Mon-Sat 11-4
  insert into appointment_availability (type_id, day_of_week, start_time, end_time)
  select t_tour, dow, '11:00', '16:00' from unnest(array[1,2,3,4,5,6]) as dow;

  -- Inquiry: Mon-Fri 1-4
  insert into appointment_availability (type_id, day_of_week, start_time, end_time)
  select t_inquiry, dow, '13:00', '16:00' from unnest(array[1,2,3,4,5]) as dow;

  -- Planning: Mon-Fri 10-5
  insert into appointment_availability (type_id, day_of_week, start_time, end_time)
  select t_planning, dow, '10:00', '17:00' from unnest(array[1,2,3,4,5]) as dow;
end $$;
