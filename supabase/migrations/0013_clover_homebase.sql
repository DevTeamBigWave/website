-- ============================================================================
-- Clover POS sync + Homebase daily labor
--
-- Clover: pulled by /api/cron/sync-clover. Each payment is one row.
-- Homebase: parsed from the daily summary email (Gmail API). One row per day.
-- ============================================================================

create table clover_payments (
  id uuid primary key default uuid_generate_v4(),
  clover_payment_id text unique not null,    -- Clover's own ID
  clover_order_id text,
  amount_cents int not null check (amount_cents >= 0),
  tip_cents int not null default 0,
  tax_cents int not null default 0,
  -- 'paid' | 'refunded' | 'voided'
  status text not null default 'paid' check (status in ('paid', 'refunded', 'voided')),
  tender_type text,                          -- credit, cash, gift, etc
  employee_clover_id text,
  device_id text,
  refunded_amount_cents int not null default 0,
  created_at_clover timestamptz not null,
  updated_at_clover timestamptz,
  raw jsonb,                                  -- full Clover payment object
  synced_at timestamptz default now()
);

create index clover_payments_created_idx on clover_payments(created_at_clover desc);
create index clover_payments_status_idx on clover_payments(status);

create table clover_sync_log (
  id uuid primary key default uuid_generate_v4(),
  sync_started_at timestamptz default now(),
  sync_finished_at timestamptz,
  from_clover_ts timestamptz,
  to_clover_ts timestamptz,
  payments_pulled int default 0,
  payments_inserted int default 0,
  payments_updated int default 0,
  error_message text
);

create index clover_sync_log_started_idx on clover_sync_log(sync_started_at desc);

create table daily_labor (
  id uuid primary key default uuid_generate_v4(),
  -- Date in NYC (YYYY-MM-DD)
  labor_date date unique not null,
  total_cost_cents int not null default 0,
  total_hours numeric(8, 2),
  per_employee jsonb,
  source text not null default 'homebase_email' check (source in ('homebase_email', 'manual', 'csv_upload')),
  source_email_id text,                      -- Gmail message ID for idempotency
  parsed_at timestamptz default now(),
  raw_text text                              -- truncated email body for debugging
);

create index daily_labor_date_idx on daily_labor(labor_date desc);

alter table clover_payments enable row level security;
alter table clover_sync_log enable row level security;
alter table daily_labor enable row level security;

create policy clover_payments_service_role on clover_payments for all using (auth.role() = 'service_role');
create policy clover_sync_log_service_role on clover_sync_log for all using (auth.role() = 'service_role');
create policy daily_labor_service_role on daily_labor for all using (auth.role() = 'service_role');
