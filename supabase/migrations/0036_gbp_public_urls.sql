-- ============================================================================
-- Capture the venue's PUBLIC Google identifiers from the Business Profile API.
--
-- gbp_location_id ("locations/123…") is an internal API resource name, not a
-- shareable link. The Business Information API returns the public place id and
-- the canonical Google Maps URL under location.metadata — we store them here so
-- they can feed SEO structured data (sameAs / hasMap) and a "Find us on Google"
-- link. Populated best-effort when a location is selected (select-location route).
-- ============================================================================

alter table google_integrations
  add column if not exists gbp_place_id text,
  add column if not exists gbp_maps_uri text;
