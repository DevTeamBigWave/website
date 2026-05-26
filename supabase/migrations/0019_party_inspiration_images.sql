-- ============================================================================
-- Customer-uploaded inspiration photos
--
-- Up to 3 reference images uploaded at booking time for the owner to see in
-- admin (custom cake design, decor theme, etc). Stored in Supabase Storage
-- bucket 'party-inspiration'; this column holds the public URLs.
-- ============================================================================

alter table parties
  add column if not exists inspiration_image_urls jsonb not null default '[]'::jsonb;
