-- ============================================================================
-- Bot knowledge snapshot
--
-- A single row (id = 1) holding the most recent scan of the public website,
-- captured by the daily 2am Railway cron (/api/cron/refresh-bot-knowledge).
-- The website chat and SMS auto-responder read it (see lib/bot-knowledge.ts)
-- so prose/page changes on the live site flow into the bot within a day,
-- while the authoritative pricing block (generated from lib/pricing.ts) always
-- wins on dollar figures.
-- ============================================================================

create table if not exists bot_knowledge (
  id int primary key default 1,
  content text,                     -- concatenated, HTML-stripped page text (bounded)
  hash text,                        -- content hash, to detect when the site changed
  pages jsonb,                      -- per-page metadata: [{ path, chars, ok }]
  scanned_at timestamptz default now(),
  constraint bot_knowledge_singleton check (id = 1)
);

alter table bot_knowledge enable row level security;
create policy bot_knowledge_service_role on bot_knowledge for all
  using (auth.role() = 'service_role');
