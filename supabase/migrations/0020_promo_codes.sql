-- ============================================================================
-- Promo codes for skipping the booking deposit
--
-- A pre-approved code (shared verbally / over text by the owner) lets a
-- parent book without paying the deposit. The party still creates fully
-- (status='confirmed', calendar event fires, confirmation emails go out,
-- CRM trigger updates customer record) — only the deposit charge is
-- skipped, so financials show the full grand-total as owed.
--
-- Doubles as a built-in QA path: owner uses an active code to fully
-- exercise the booking pipeline without spending money on test cards.
--
-- A monthly cron generates a fresh code on the 1st and expires older
-- ones. Owner can also generate ad-hoc codes via the admin UI.
-- ============================================================================

create table promo_codes (
  id uuid primary key default uuid_generate_v4(),

  -- Customer-facing code, e.g. SKIP-7K2M-9XQR. Unique, uppercase.
  code text unique not null,

  -- Only one kind today, but explicit so future kinds (% off, $ off,
  -- comp open-play) slot in cleanly without conditional-by-string code.
  kind text not null default 'skip_deposit'
    check (kind in ('skip_deposit')),

  -- Lifecycle
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,

  -- Usage caps. max_uses null = unlimited (within valid window).
  max_uses int,
  uses_count int not null default 0,

  -- Audit
  created_by_admin_id uuid references admin_users(id) on delete set null,
  rotation_origin text,   -- 'monthly_cron' | 'manual_admin' | null
  notes text,             -- optional internal note about why it was issued

  created_at timestamptz default now()
);

create index promo_codes_active_idx
  on promo_codes(valid_until desc) where uses_count is not null;

-- Link from parties → the promo code used (if any)
alter table parties
  add column if not exists promo_code_id uuid references promo_codes(id) on delete set null;

-- RLS: service-role only (validation + use happen in server routes)
alter table promo_codes enable row level security;
create policy promo_codes_service_role on promo_codes for all
  using (auth.role() = 'service_role');

-- Atomic uses_count increment used by recordPromoUse() — keeps counter
-- correct even under concurrent bookings without an explicit transaction.
create or replace function promo_codes_increment_use(p_id uuid)
returns void as $$
begin
  update promo_codes set uses_count = uses_count + 1 where id = p_id;
end;
$$ language plpgsql security definer;
