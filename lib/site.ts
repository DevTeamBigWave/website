// Canonical production origin — the single source of truth for every SEO
// surface (robots, sitemap, llms.txt, canonical URLs, Open Graph, JSON-LD).
// Uses the www host to match the live domain; trailing slash stripped so we
// never emit "https://host//path".
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com'
).replace(/\/$/, '');
