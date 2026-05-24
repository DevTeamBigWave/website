-- ============================================================================
-- Weekly Saturday marketing draft
--
-- Admin writes the next Saturday's email anytime during the week. If they
-- leave subject/body blank, the Saturday cron generates one with Claude
-- using brand voice + any context notes the admin provided.
--
-- One row per target Saturday. Idempotent — cron won't re-send if status='sent'.
-- ============================================================================

create table weekly_marketing_drafts (
  id uuid primary key default uuid_generate_v4(),

  -- The Saturday this email is targeted for (date, NYC). Unique so we can
  -- only schedule one per week — UPDATE the existing row to change it.
  target_send_date date unique not null,

  -- Optional context for the AI generator
  notes_for_generator text,

  -- Optional pre-filled fields. If pre_subject + pre_body both set, the cron
  -- uses them verbatim. Otherwise Claude generates using notes + brand voice.
  pre_subject text,
  pre_body text,
  pre_cta_label text,
  pre_cta_href text,

  -- Whatever was actually sent (generated values stored after Saturday cron runs)
  sent_subject text,
  sent_body text,
  sent_cta_label text,
  sent_cta_href text,
  generated_by_ai boolean default false,

  status text not null default 'queued' check (
    status in ('queued', 'sent', 'cancelled', 'failed')
  ),

  campaign_id text,    -- ties to marketing_sends.campaign_id when sent
  sent_at timestamptz,
  error_message text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index weekly_marketing_drafts_date_idx on weekly_marketing_drafts(target_send_date desc);
create index weekly_marketing_drafts_status_idx on weekly_marketing_drafts(status);

create trigger weekly_marketing_drafts_updated_at before update on weekly_marketing_drafts
  for each row execute function set_updated_at();

alter table weekly_marketing_drafts enable row level security;
create policy weekly_marketing_drafts_service_role on weekly_marketing_drafts for all
  using (auth.role() = 'service_role');
