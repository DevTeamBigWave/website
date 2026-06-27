// Canonical production origin — the single source of truth for every SEO
// surface (robots, sitemap, llms.txt, canonical URLs, Open Graph, JSON-LD).
// Uses the www host to match the live domain; trailing slash stripped so we
// never emit "https://host//path".
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com'
).replace(/\/$/, '');

// Public Google Maps / Business Profile URL for the venue, used in SEO
// structured data (sameAs / hasMap) and "Find us on Google" links. The GBP API
// auto-captures the canonical URL into the integration (shown on the admin
// Hours / Google Business page); paste it here so static pages can render it.
// e.g. NEXT_PUBLIC_GOOGLE_MAPS_URL=https://maps.google.com/?cid=1234567890
export const GOOGLE_MAPS_URL = process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL?.trim() || null;
export const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID?.trim() || null;
