-- ============================================================================
-- Waivers: parent signs once per year, covering one or more children.
--
-- A waiver is valid for 365 days. The /waiver page checks by email — if any
-- valid waiver exists for the parent, we surface their kids and let them
-- skip re-signing for kids already covered.
--
-- Each child waiver is its own row in waiver_children (so we can track
-- exactly which kids were on the document the parent agreed to). The kid
-- may or may not match an existing children row; if matched we set child_id,
-- if it's a new kid we create the children row and link.
-- ============================================================================

create table waivers (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,

  -- Cached identity (in case customer row is later edited)
  parent_name text not null,
  parent_email text not null,
  parent_phone text not null,

  -- Emergency contact (separate person if possible)
  emergency_contact_name text,
  emergency_contact_phone text,

  -- Signature: canvas drawing as base64 PNG data URL
  signature_data_url text not null,
  -- Backup: typed full name from the print-name field
  signature_typed_name text not null,

  -- Audit trail
  document_version text not null,         -- e.g. 'v1-2026-05'
  signature_ip text,
  signature_ua text,

  signed_at timestamptz not null default now(),
  expires_at timestamptz not null,        -- signed_at + 365 days, set in API

  -- Soft-revoke for legal/admin reasons (e.g. they request data deletion)
  revoked_at timestamptz,
  revoked_reason text,

  created_at timestamptz default now()
);

create index waivers_email_idx on waivers(parent_email);
create index waivers_expires_at_idx on waivers(expires_at);
create index waivers_customer_idx on waivers(customer_id);
create index waivers_signed_at_idx on waivers(signed_at desc);

-- One row per child covered by a signing event
create table waiver_children (
  id uuid primary key default uuid_generate_v4(),
  waiver_id uuid not null references waivers(id) on delete cascade,
  child_id uuid references children(id) on delete set null,

  -- Denormalized for audit: even if child_id row changes, we know exactly
  -- what was on the doc at signing
  child_name text not null,
  child_dob date,
  allergies text,
  notes text,

  created_at timestamptz default now()
);

create index waiver_children_waiver_idx on waiver_children(waiver_id);
create index waiver_children_child_idx on waiver_children(child_id);

alter table waivers enable row level security;
alter table waiver_children enable row level security;

create policy waivers_service_role on waivers for all
  using (auth.role() = 'service_role');
create policy waiver_children_service_role on waiver_children for all
  using (auth.role() = 'service_role');
