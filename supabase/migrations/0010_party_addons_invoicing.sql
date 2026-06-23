-- ============================================================================
-- Party add-ons + balance invoicing
--
-- After deposit is paid, the owner can add items (cake, entertainment, decor
-- upgrade, etc) from the catalog (or custom) in the admin party detail page.
-- Each add-on is a row in party_add_ons; the parties.add_ons_total_cents is
-- denormalized for quick reads (recalculated whenever an add-on is added/removed).
--
-- "Send balance invoice" creates a Stripe Invoice for the remaining balance
-- (total + add-ons − deposit paid − any gift card already applied) and emails
-- the parent a branded hosted-invoice link. Stripe webhook flips
-- balance_paid_at on invoice.paid.
-- ============================================================================

create table party_add_ons (
  id uuid primary key default uuid_generate_v4(),
  party_id uuid not null references parties(id) on delete cascade,

  -- Identifier from the catalog (e.g. 'face_painting'), or null for custom items.
  catalog_id text,

  name text not null,                       -- shown on invoice + emails
  unit_price_cents int not null check (unit_price_cents >= 0),
  qty int not null default 1 check (qty > 0),
  notes text,

  added_by_admin_id uuid references admin_users(id) on delete set null,
  created_at timestamptz default now()
);

create index party_add_ons_party_idx on party_add_ons(party_id);

-- Denormalized totals + invoice state on the party row
alter table parties
  add column if not exists add_ons_total_cents int not null default 0,
  add column if not exists balance_invoice_id text,
  add column if not exists balance_invoice_hosted_url text,
  add column if not exists balance_invoice_sent_at timestamptz,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists balance_paid_amount_cents int,
  add column if not exists planning_call_email_sent_at timestamptz;

create index if not exists parties_balance_invoice_id_idx on parties(balance_invoice_id);

-- RLS: service role only (admin endpoints)
alter table party_add_ons enable row level security;
create policy party_add_ons_service_role on party_add_ons for all
  using (auth.role() = 'service_role');

-- Trigger: keep parties.add_ons_total_cents in sync
create or replace function recalc_party_add_ons_total()
returns trigger as $$
declare
  v_party_id uuid;
  v_total int;
begin
  v_party_id := coalesce(new.party_id, old.party_id);

  select coalesce(sum(unit_price_cents * qty), 0)
    into v_total
    from party_add_ons
   where party_id = v_party_id;

  update parties set add_ons_total_cents = v_total where id = v_party_id;
  return new;
end;
$$ language plpgsql;

create trigger party_add_ons_recalc
after insert or update or delete on party_add_ons
for each row execute function recalc_party_add_ons_total();
