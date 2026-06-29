-- ============================================================================
-- SMS message log — every inbound and outbound text, so the owner can see the
-- full conversation history in the admin SMS inbox.
--
--   direction = 'inbound'   → a customer texted the business number
--   direction = 'outbound'  → we texted them (AI auto-reply, owner manual reply,
--                             or an automated notification)
--   sender    = 'ai' | 'owner' | 'system' (outbound only; null for inbound)
--
-- Service-role only (admin portal reads via supabaseAdmin).
-- ============================================================================

create table if not exists sms_messages (
  id uuid primary key default uuid_generate_v4(),
  -- The customer's number (E.164, e.g. +17185551234). Threads group on this.
  contact_phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  sender text check (sender in ('ai', 'owner', 'system')),
  status text,            -- 'received' | 'sent' | 'queued' | 'failed' | etc.
  twilio_sid text,
  error text,
  created_at timestamptz default now()
);

create index if not exists sms_messages_contact_idx on sms_messages(contact_phone, created_at);
create index if not exists sms_messages_created_idx on sms_messages(created_at desc);

alter table sms_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'sms_messages' and policyname = 'sms_messages_service_role'
  ) then
    create policy sms_messages_service_role on sms_messages for all
      using (auth.role() = 'service_role');
  end if;
end $$;
