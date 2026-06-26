-- ============================================================================
-- Venue hours overrides — admin-set custom hours / closures for specific
-- future dates, mirroring Google Business Profile's special-hours editor.
--
--   closed = true                  → venue closed all day
--   closed = false + open/close    → custom open window (open late / close early)
--
-- These feed BOTH the Google Business Profile special-hours sync (lib/gbp.ts)
-- AND on-site booking availability (parties + open play) so a date the owner
-- closes/limits can't be booked.
-- ============================================================================

create table if not exists venue_hours_override (
  date date primary key,
  closed boolean not null default false,
  -- minutes since midnight (e.g. 720 = 12:00, 1170 = 19:30). null when closed.
  open_minutes int,
  close_minutes int,
  note text,
  created_by uuid,
  created_at timestamptz default now(),
  -- a custom window must have a valid open < close range
  constraint venue_hours_override_window_chk check (
    closed
    or (open_minutes is not null and close_minutes is not null and open_minutes < close_minutes)
  )
);

create index if not exists venue_hours_override_date_idx on venue_hours_override(date);

alter table venue_hours_override enable row level security;
create policy venue_hours_override_service_role on venue_hours_override for all
  using (auth.role() = 'service_role');
