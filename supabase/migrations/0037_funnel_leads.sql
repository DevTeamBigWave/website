-- ============================================================================
-- Funnel leads — top-of-funnel captures from the /go/* quiz funnels.
--
-- These are NOT bookings and NOT confirmed customers (the CRM `customers` table
-- is trigger-populated from real bookings). A funnel lead is someone who
-- completed a quiz and gave contact info at the reveal. Stored fail-safe
-- (always written before any notification), service-role only (no public read).
--
-- Idempotent + RLS in this same file. Append-only migration; run by hand against
-- the client's own Supabase.
-- ============================================================================

create table if not exists funnel_leads (
  id uuid primary key default uuid_generate_v4(),

  -- Which funnel produced this lead (the funnel slug, e.g. 'party-planner').
  source text not null,

  -- The branching segment the visitor picked first (e.g. 'privacy' | 'budget' | 'wow').
  segment text,

  -- Minimal contact captured at the reveal.
  name text not null,
  email text not null,
  phone text,

  -- The full quiz answers and the computed result, for follow-up + analytics.
  answers jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,

  -- Denormalized headline fields for quick admin scanning.
  recommended_package text,
  headcount int,

  -- Light provenance.
  referrer text,
  user_agent text,

  created_at timestamptz default now()
);

create index if not exists funnel_leads_created_idx on funnel_leads(created_at desc);
create index if not exists funnel_leads_source_idx on funnel_leads(source, created_at desc);
create index if not exists funnel_leads_email_idx on funnel_leads(email);

-- Service-role only: the capture route uses supabaseAdmin() (service key), and
-- there is no public read of lead PII — mirrors the CRM tables' policy.
alter table funnel_leads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'funnel_leads' and policyname = 'funnel_leads_service_role'
  ) then
    create policy funnel_leads_service_role on funnel_leads for all
      using (auth.role() = 'service_role');
  end if;
end $$;
