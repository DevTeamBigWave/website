-- ============================================================================
-- Google Calendar integration
--
-- Adds:
--   google_integrations — stores OAuth refresh token for the owner's
--                         Google Calendar, used server-side to create events
--                         when parties are confirmed.
--
-- Extends:
--   parties — google_calendar_event_id so we can update/delete the event
--             later (on cancellation, reschedule, etc.)
-- ============================================================================

create table google_integrations (
  id uuid primary key default uuid_generate_v4(),
  admin_user_id uuid references admin_users(id) on delete cascade,

  -- 'calendar' is the only scope today. Future: 'gmail', 'drive', etc.
  scope text not null default 'calendar',

  -- The owner's Google account that authorized us. Display only.
  google_email text,

  -- The actual tokens. refresh_token never expires (until revoked); we use
  -- it to mint fresh access_tokens as needed.
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,

  -- Which calendar to write events to. 'primary' = the user's main calendar.
  -- Later we could let staff pick a specific calendar ID.
  calendar_id text not null default 'primary',

  connected_at timestamptz default now(),
  last_used_at timestamptz,

  -- Only one active integration per scope per admin user
  unique (admin_user_id, scope)
);

alter table parties add column google_calendar_event_id text;
create index parties_google_event_idx on parties(google_calendar_event_id)
  where google_calendar_event_id is not null;

-- RLS: service-role only (admin portal + webhooks use service key)
alter table google_integrations enable row level security;
create policy google_integrations_service_role on google_integrations for all
  using (auth.role() = 'service_role');
