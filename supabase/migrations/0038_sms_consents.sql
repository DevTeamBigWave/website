-- ============================================================================
-- SMS consent log — proof of opt-in for A2P 10DLC compliance.
--
-- Records every time someone affirmatively checks the SMS consent box on a
-- website form (booking, open play, appointment). Carriers / TCR can request
-- opt-in evidence during an audit; this is that record. Written best-effort by
-- /api/sms/consent, fully decoupled from booking/checkout so it can never
-- affect a purchase.
-- ============================================================================

create table if not exists sms_consents (
  id uuid primary key default uuid_generate_v4(),
  phone text not null,
  name text,
  -- Which form the consent came from: 'appointment' | 'party_booking' | 'open_play'
  source text,
  -- Snapshot of which consent language version the user agreed to.
  consent_version text,
  ip text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists sms_consents_phone_idx on sms_consents(phone);
create index if not exists sms_consents_created_idx on sms_consents(created_at desc);

alter table sms_consents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'sms_consents' and policyname = 'sms_consents_service_role'
  ) then
    create policy sms_consents_service_role on sms_consents for all
      using (auth.role() = 'service_role');
  end if;
end $$;
