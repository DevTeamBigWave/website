-- ============================================================================
-- Google Business Profile integration — extends google_integrations with the
-- selected location ID and last sync info for the special-hours sync cron.
-- ============================================================================

alter table google_integrations
  add column if not exists gbp_account_id text,
  add column if not exists gbp_location_id text,
  add column if not exists gbp_location_title text,
  add column if not exists gbp_last_sync_at timestamptz,
  add column if not exists gbp_last_sync_error text;

create table if not exists gbp_sync_log (
  id uuid primary key default uuid_generate_v4(),
  sync_started_at timestamptz default now(),
  sync_finished_at timestamptz,
  periods_pushed int default 0,
  date_range_start date,
  date_range_end date,
  error_message text,
  raw_request jsonb,
  raw_response jsonb
);

create index if not exists gbp_sync_log_started_idx on gbp_sync_log(sync_started_at desc);

alter table gbp_sync_log enable row level security;
create policy gbp_sync_log_service_role on gbp_sync_log for all
  using (auth.role() = 'service_role');
